// Deterministic, state-based seller workflow.
// Pure functions only: used by the API (authoritative validation) and the UI (labels, quick replies).

export const GREETING =
  "Hello! I'm the KJ Cars Assistant. I'll help you submit your car details for review. What is the make of your car?";

export const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Plug-in hybrid", "Electric", "LPG/CNG", "Other"] as const;
export const TRANSMISSIONS = ["Manual", "Automatic", "Semi-automatic"] as const;

export const MAX_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const MIN_YEAR = 1900;
export const MAX_MILEAGE_KM = 2_000_000;
export const MAX_PRICE_EUR = 10_000_000;
export const MAX_TEXT = 1000;

export type EnquiryData = {
  make: string | null;
  model: string | null;
  year: number | null;
  registration: string | null;
  vin: string | null;
  mileageKm: number | null;
  fuelType: string | null;
  transmission: string | null;
  serviceHistory: string | null;
  defects: string | null;
  askingPriceEur: number | null;
  location: string | null;
  sellerName: string | null;
  email: string | null;
  phone: string | null;
};

export type EditableField = keyof EnquiryData;

export const STEP_ORDER = [
  "make",
  "model",
  "year",
  "registration",
  "vin",
  "mileage",
  "fuel",
  "transmission",
  "service",
  "defects",
  "price",
  "location",
  "photos",
  "name",
  "contact",
  "summary",
  "submitted",
] as const;

export type StepKey = (typeof STEP_ORDER)[number];

export function isStepKey(value: string): value is StepKey {
  return (STEP_ORDER as readonly string[]).includes(value);
}

export const FIELD_LABELS: Record<EditableField, string> = {
  make: "Make",
  model: "Model",
  year: "Year of first registration",
  registration: "Registration number",
  vin: "VIN",
  mileageKm: "Mileage (km)",
  fuelType: "Fuel type",
  transmission: "Transmission",
  serviceHistory: "Service history and maintenance",
  defects: "Known faults, damage or defects",
  askingPriceEur: "Asking price (EUR)",
  location: "Vehicle location",
  sellerName: "Seller's name",
  email: "Email",
  phone: "Phone",
};

export const VEHICLE_FIELDS: EditableField[] = [
  "make",
  "model",
  "year",
  "registration",
  "vin",
  "mileageKm",
  "fuelType",
  "transmission",
  "serviceHistory",
  "defects",
  "askingPriceEur",
  "location",
];
export const SELLER_FIELDS: EditableField[] = ["sellerName", "email", "phone"];

// ---------------------------------------------------------------------------
// Answer helpers

const UNKNOWN_RE = /^(i\s*(do\s*not|don'?t|dont)\s*know|don'?t\s*know|dont\s*know|idk|not\s*sure|unsure|unknown|no\s*idea)[.!]?$/i;
const SKIP_RE = /^(skip|skip\s*it|skip\s*this|pass|n\/?a|-|no\s*vin|rather\s*not|prefer\s*not\s*to\s*say)[.!]?$/i;

export const isUnknown = (text: string) => UNKNOWN_RE.test(text.trim());
export const isSkip = (text: string) => SKIP_RE.test(text.trim());

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const fail = <T,>(error: string): Result<T> => ({ ok: false, error });

function cleanText(raw: string, label: string, min: number, max: number): Result<string> {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length < min) return fail(`Please enter the ${label}.`);
  if (value.length > max) return fail(`The ${label} can be at most ${max} characters.`);
  return ok(value);
}

/** Parses "12 500", "12,500", "€12.500", "120k", "120 000 km" into an integer. */
export function parseAmount(raw: string): number | null {
  let text = raw.trim().toLowerCase().replace(/(eur|euros?|€|kms?|kilometres?|kilometers?)/g, "").trim();
  if (/^-/.test(text)) return -1;
  let multiplier = 1;
  const k = text.match(/^([\d.,\s]+)\s*k$/);
  if (k) {
    multiplier = 1000;
    text = k[1];
  }
  text = text.replace(/\s+/g, "");
  if (!/^\d[\d.,]*$/.test(text)) return null;
  // Treat a trailing ",dd" or ".dd" as decimals; other separators as thousands.
  const decimal = text.match(/^(.*)[.,](\d{1,2})$/);
  let whole = text;
  let fraction = 0;
  if (decimal) {
    whole = decimal[1];
    fraction = Number(`0.${decimal[2]}`);
  }
  whole = whole.replace(/[.,]/g, "");
  if (!/^\d+$/.test(whole)) return null;
  return Math.round((Number(whole) + fraction) * multiplier);
}

// ---------------------------------------------------------------------------
// Field validators (shared by the chat flow and summary editing)

export function validateMake(raw: string) {
  if (isUnknown(raw) || isSkip(raw)) return fail<string>("The make is needed so KJ Cars can review your car. For example: Toyota, Volkswagen or Skoda.");
  return cleanText(raw, "make", 1, 40);
}

export function validateModel(raw: string) {
  if (isUnknown(raw) || isSkip(raw)) return fail<string>("The model is needed so KJ Cars can review your car. You can usually find it in the registration document.");
  return cleanText(raw, "model", 1, 60);
}

export function validateYear(raw: string): Result<number> {
  const currentYear = new Date().getFullYear();
  if (isUnknown(raw)) return fail("The year of first registration is needed. You can find it in the vehicle registration document.");
  const match = raw.match(/\b(\d{4})\b/);
  if (!match || raw.replace(/\D/g, "").length !== 4) return fail(`Please enter the year as four digits, for example ${currentYear - 8}.`);
  const year = Number(match[1]);
  if (year > currentYear) return fail(`The year of first registration can't be in the future. Please enter a year up to ${currentYear}.`);
  if (year < MIN_YEAR) return fail(`Please enter a year between ${MIN_YEAR} and ${currentYear}.`);
  return ok(year);
}

export function validateRegistration(raw: string): Result<string> {
  if (isUnknown(raw) || isSkip(raw)) return fail("The registration number is needed so KJ Cars can identify the vehicle.");
  const value = raw.trim().toUpperCase().replace(/\s+/g, " ");
  if (!/^[A-Z0-9][A-Z0-9 -]{0,10}[A-Z0-9]$/.test(value) || !/\d|[A-Z]/.test(value)) {
    return fail("That doesn't look like a registration number. Please use 2-12 letters and digits (spaces and hyphens are fine), for example 123 ABC.");
  }
  return ok(value);
}

/** VIN is optional: empty, "skip" or "I don't know" mean not provided. */
export function validateVin(raw: string): Result<string | null> {
  if (!raw.trim() || isUnknown(raw) || isSkip(raw)) return ok(null);
  const value = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  if (/[IOQ]/.test(value) && value.length === 17) {
    return fail("A VIN never contains the letters I, O or Q (they are easily confused with 1 and 0). Please check it, or type \"skip\".");
  }
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(value)) {
    return fail(`A VIN has exactly 17 letters and digits (you entered ${value.length} characters). Please check it, or type "skip".`);
  }
  return ok(value);
}

export function validateMileage(raw: string): Result<number> {
  if (isUnknown(raw)) return fail("The mileage is needed for the review. An approximate reading from the odometer is fine.");
  if (/\bmi(les?)?\b/i.test(raw)) return fail("Please give the mileage in kilometres (1 mile is about 1.609 km).");
  const value = parseAmount(raw);
  if (value === null) return fail("Please enter the mileage as a number of kilometres, for example 145000.");
  if (value < 0) return fail("Mileage can't be negative. Please enter the number of kilometres.");
  if (value > MAX_MILEAGE_KM) return fail(`That mileage looks too high. Please enter a value up to ${MAX_MILEAGE_KM.toLocaleString("en-GB")} km.`);
  return ok(value);
}

export function validateFuel(raw: string): Result<string> {
  const t = raw.trim().toLowerCase();
  const pick =
    /plug|phev/.test(t) ? "Plug-in hybrid"
    : /hybrid|hev/.test(t) ? "Hybrid"
    : /electric|^ev$|^bev$|battery/.test(t) ? "Electric"
    : /petrol|gasoline|benzin|^gas$|unleaded/.test(t) ? "Petrol"
    : /diesel/.test(t) ? "Diesel"
    : /lpg|cng|autogas/.test(t) ? "LPG/CNG"
    : /^other/.test(t) ? "Other"
    : null;
  if (!pick) return fail(`Please choose a fuel type: ${FUEL_TYPES.join(", ")}.`);
  return ok(pick);
}

export function validateTransmission(raw: string): Result<string> {
  const t = raw.trim().toLowerCase();
  const pick =
    /semi/.test(t) ? "Semi-automatic"
    : /manual|stick|gearbox|^m$/.test(t) ? "Manual"
    : /auto|dsg|cvt|^a$/.test(t) ? "Automatic"
    : null;
  if (!pick) return fail(`Please choose a transmission: ${TRANSMISSIONS.join(", ")}.`);
  return ok(pick);
}

export function validateServiceHistory(raw: string): Result<string> {
  if (isUnknown(raw)) return ok("Unknown");
  return cleanText(raw, "service history", 1, MAX_TEXT);
}

export function validateDefects(raw: string): Result<string> {
  if (isUnknown(raw)) return ok("Unknown");
  if (/^(no|none|nothing|no faults?|no defects?|none known|no known (faults|defects|issues))[.!]?$/i.test(raw.trim())) {
    return ok("None reported");
  }
  return cleanText(raw, "description of faults or damage", 1, MAX_TEXT);
}

export function validatePrice(raw: string): Result<number> {
  if (isUnknown(raw)) return fail("Please enter the price you would like for the car in euros. KJ Cars will still make its own assessment.");
  const value = parseAmount(raw);
  if (value === null) return fail("Please enter the asking price as a number of euros, for example 8500.");
  if (value < 0) return fail("The asking price can't be negative.");
  if (value > MAX_PRICE_EUR) return fail(`Please enter an asking price up to €${MAX_PRICE_EUR.toLocaleString("en-GB")}.`);
  return ok(value);
}

export function validateLocation(raw: string) {
  if (isUnknown(raw) || isSkip(raw)) return fail<string>("Please tell us where the car is located (town or city) so KJ Cars can plan an inspection.");
  return cleanText(raw, "vehicle location", 2, 100);
}

export function validateName(raw: string): Result<string> {
  if (isUnknown(raw) || isSkip(raw)) return fail("Please tell us your name so KJ Cars knows who to contact.");
  const r = cleanText(raw.trim().replace(/^(my name is|my name's|i am|i'm|it's|it is|this is)\s+/i, ""), "name", 2, 80);
  if (!r.ok) return r;
  if (!/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(r.value)) return fail("Please enter your name using letters (spaces, hyphens and apostrophes are fine).");
  return r;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(raw: string): Result<string | null> {
  const value = raw.trim().toLowerCase();
  if (!value) return ok(null);
  if (value.length > 254 || !EMAIL_RE.test(value)) return fail(`"${raw.trim().slice(0, 60)}" is not a valid email address. Please check it, for example name@example.com.`);
  return ok(value);
}

export function validatePhone(raw: string): Result<string | null> {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return ok(null);
  const digits = value.replace(/\D/g, "");
  if (!/^\+?[\d\s().-]+$/.test(value) || digits.length < 7 || digits.length > 15) {
    return fail("Please enter a valid phone number with 7-15 digits, for example +372 5123 4567.");
  }
  return ok(value);
}

/** Extracts an email and/or phone number from one free-text answer. */
export function parseContact(raw: string): Result<{ email: string | null; phone: string | null }> {
  const text = raw.trim();
  let email: string | null = null;
  let rest = text;
  const emailToken = text.match(/[^\s,;<>]+@[^\s,;<>]+/);
  if (emailToken) {
    const e = validateEmail(emailToken[0].replace(/[.)]+$/, ""));
    if (!e.ok) return e;
    email = e.value;
    rest = text.replace(emailToken[0], " ");
  } else if (text.includes("@")) {
    return fail("That email address doesn't look valid. Please check it, for example name@example.com.");
  }
  let phone: string | null = null;
  const phoneToken = rest.match(/\+?\d[\d\s().-]{4,}\d/);
  if (phoneToken) {
    const p = validatePhone(phoneToken[0]);
    if (!p.ok) return p;
    phone = p.value;
  }
  if (!email && !phone) {
    return fail("Please give at least one way to contact you: a valid email address (name@example.com) or a phone number (+372 5123 4567).");
  }
  return ok({ email, phone });
}

const FIELD_VALIDATORS: Record<EditableField, (raw: string) => Result<string | number | null>> = {
  make: validateMake,
  model: validateModel,
  year: validateYear,
  registration: validateRegistration,
  vin: validateVin,
  mileageKm: validateMileage,
  fuelType: validateFuel,
  transmission: validateTransmission,
  serviceHistory: validateServiceHistory,
  defects: validateDefects,
  askingPriceEur: validatePrice,
  location: validateLocation,
  sellerName: validateName,
  email: validateEmail,
  phone: validatePhone,
};

export function isEditableField(value: string): value is EditableField {
  return value in FIELD_VALIDATORS;
}

/** Validates one field edit from the summary, including the "at least one contact" rule. */
export function validateFieldEdit(
  data: EnquiryData,
  field: EditableField,
  raw: string,
): Result<string | number | null> {
  if (raw.length > MAX_TEXT + 100) return fail("That value is too long.");
  const result = FIELD_VALIDATORS[field](raw);
  if (!result.ok) return result;
  if (field === "email" && result.value === null && !data.phone) return fail("Please keep at least one contact method: an email address or a phone number.");
  if (field === "phone" && result.value === null && !data.email) return fail("Please keep at least one contact method: an email address or a phone number.");
  return result;
}

/** Returns a list of problems that prevent submission (empty when ready). */
export function missingForSubmission(data: EnquiryData): string[] {
  const required: EditableField[] = [
    "make", "model", "year", "registration", "mileageKm", "fuelType", "transmission",
    "serviceHistory", "defects", "askingPriceEur", "location", "sellerName",
  ];
  const missing = required.filter((f) => data[f] === null || data[f] === "").map((f) => FIELD_LABELS[f]);
  if (!data.email && !data.phone) missing.push("Email or phone");
  return missing;
}

// ---------------------------------------------------------------------------
// Questions

export function questionFor(step: StepKey, data: Partial<EnquiryData> = {}): string {
  switch (step) {
    case "make": return "What is the make of your car?";
    case "model": return `What is the model of your ${data.make ?? "car"}?`;
    case "year": return `What year was the car first registered? (for example, ${new Date().getFullYear() - 8})`;
    case "registration": return "What is the car's registration number (number plate)?";
    case "vin": return "What is the VIN (the 17-character vehicle identification number)? This is optional - type \"skip\" if you'd rather not share it, or \"I don't know\".";
    case "mileage": return "What is the current mileage in kilometres?";
    case "fuel": return `What fuel type does it use? (${FUEL_TYPES.join(", ")})`;
    case "transmission": return "Is the transmission manual, automatic or semi-automatic?";
    case "service": return "Please describe the service history and any recent major maintenance (for example: full dealer service history, timing belt replaced in 2023). You can answer \"I don't know\".";
    case "defects": return "Are there any known faults, accident damage or other defects? Please describe them, or answer \"none\". You can also answer \"I don't know\".";
    case "price": return "What is your asking price in euros (EUR)?";
    case "location": return "Where is the vehicle located (town or city)?";
    case "photos": return `You can add up to ${MAX_PHOTOS} photos of the car (JPEG, PNG or WebP, up to 5 MB each) with the "Attach File" button. When you've finished, type "done" - or type "skip" to continue without photos.`;
    case "name": return "What is your name?";
    case "contact": return "How can KJ Cars contact you about this enquiry? Please give an email address and/or a phone number.";
    case "summary": return "Please review the summary below. You can edit any field, then confirm and select \"Submit Enquiry\".";
    case "submitted": return "This enquiry has already been submitted. KJ Cars will review the information before making any offer.";
  }
}

export function quickRepliesFor(step: StepKey): string[] {
  switch (step) {
    case "vin": return ["Skip", "I don't know"];
    case "fuel": return [...FUEL_TYPES];
    case "transmission": return [...TRANSMISSIONS];
    case "service": return ["I don't know"];
    case "defects": return ["None", "I don't know"];
    case "photos": return ["Done", "Skip"];
    default: return [];
  }
}

// ---------------------------------------------------------------------------
// State machine

export type FlowOutcome = {
  reply: string;
  updates: Partial<EnquiryData>;
  nextStep: StepKey;
  /** True when the answer was accepted (step advanced). */
  accepted: boolean;
};

const nextOf = (step: StepKey): StepKey => STEP_ORDER[Math.min(STEP_ORDER.indexOf(step) + 1, STEP_ORDER.length - 1)];

function formatEur(n: number) {
  return `€${n.toLocaleString("en-GB")}`;
}

/**
 * Applies one customer answer to the current step.
 * Never invents vehicle facts and never makes an offer: it only records what the customer says.
 */
export function processAnswer(step: StepKey, data: EnquiryData, text: string, photoCount: number): FlowOutcome {
  const answer = text.trim();
  const stay = (error: string): FlowOutcome => ({
    reply: `${error}\n\n${questionFor(step, data)}`,
    updates: {},
    nextStep: step,
    accepted: false,
  });
  const advance = (updates: Partial<EnquiryData>, ack: string): FlowOutcome => {
    const nextStep = nextOf(step);
    const merged = { ...data, ...updates };
    const reply = nextStep === "summary"
      ? `${ack} Thank you${merged.sellerName ? `, ${merged.sellerName}` : ""}! I've put together a summary of your enquiry below. Please check every detail, edit anything that needs correcting, then confirm and select "Submit Enquiry".`
      : `${ack} ${questionFor(nextStep, merged)}`.trim();
    return { reply, updates, nextStep, accepted: true };
  };
  const run = <T,>(r: Result<T>, apply: (v: T) => FlowOutcome) => (r.ok ? apply(r.value) : stay(r.error));

  switch (step) {
    case "make": return run(validateMake(answer), (v) => advance({ make: v }, "Thanks."));
    case "model": return run(validateModel(answer), (v) => advance({ model: v }, `Thanks - a ${data.make} ${v}.`));
    case "year": return run(validateYear(answer), (v) => advance({ year: v }, `First registered in ${v}, noted.`));
    case "registration": return run(validateRegistration(answer), (v) => advance({ registration: v }, `Registration ${v}, noted.`));
    case "vin": return run(validateVin(answer), (v) => advance({ vin: v }, v ? "Thanks, VIN noted." : "No problem, we'll continue without the VIN."));
    case "mileage": return run(validateMileage(answer), (v) => advance({ mileageKm: v }, `${v.toLocaleString("en-GB")} km, noted.`));
    case "fuel": return run(validateFuel(answer), (v) => advance({ fuelType: v }, `${v}, noted.`));
    case "transmission": return run(validateTransmission(answer), (v) => advance({ transmission: v }, `${v}, noted.`));
    case "service": return run(validateServiceHistory(answer), (v) => advance({ serviceHistory: v }, v === "Unknown" ? "That's fine, I've recorded the service history as unknown." : "Thank you, I've recorded the service history as you described it."));
    case "defects": return run(validateDefects(answer), (v) => advance({ defects: v },
      v === "Unknown" ? "Understood, I've recorded this as unknown. KJ Cars would check the condition during an inspection."
      : v === "None reported" ? "Thanks, I've recorded no known faults."
      : "Thank you for being open about this - I've recorded it as you described it."));
    case "price": return run(validatePrice(answer), (v) => advance({ askingPriceEur: v }, `Asking price ${formatEur(v)}, noted. KJ Cars will review this together with the rest of your details.`));
    case "location": return run(validateLocation(answer), (v) => advance({ location: v }, `Location ${v}, noted.`));
    case "photos": {
      if (/^(done|finished|ready|that'?s all|ok|okay|continue|next)[.!]?$/i.test(answer) || isSkip(answer) || /^no( photos)?[.!]?$/i.test(answer)) {
        const ack = photoCount > 0
          ? `Thanks, I've saved ${photoCount} photo${photoCount === 1 ? "" : "s"}.`
          : "No problem, we'll continue without photos. You can still add them from the summary.";
        return advance({}, ack);
      }
      return stay(photoCount > 0
        ? `You have ${photoCount} of ${MAX_PHOTOS} photos so far.`
        : "To add photos, select \"Attach File\" (the paperclip next to the message box).");
    }
    case "name": return run(validateName(answer), (v) => advance({ sellerName: v }, `Nice to meet you, ${v}.`));
    case "contact": return run(parseContact(answer), (v) => advance(v,
      `Thanks, I'll record ${[v.email, v.phone].filter(Boolean).join(" and ")} as your contact details.`));
    case "summary":
      return { reply: questionFor("summary"), updates: {}, nextStep: "summary", accepted: false };
    case "submitted":
      return { reply: questionFor("submitted"), updates: {}, nextStep: "submitted", accepted: false };
  }
}
