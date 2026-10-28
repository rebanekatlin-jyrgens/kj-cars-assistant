// Offline checks for the seller workflow and validators (no database needed).
// Run: npm run test:flow
import assert from "node:assert/strict";
import {
  missingForSubmission, parseAmount, parseContact, processAnswer, validateFieldEdit, validateVin, validateYear,
  type EnquiryData, type StepKey,
} from "../src/lib/seller/flow";
import { evaluateArithmetic } from "../src/lib/server/simulate";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const empty: EnquiryData = {
  make: null, model: null, year: null, registration: null, vin: null, mileageKm: null, fuelType: null, transmission: null,
  serviceHistory: null, defects: null, askingPriceEur: null, location: null, sellerName: null, email: null, phone: null,
};

check("full guided flow reaches summary with fictional data", () => {
  let step: StepKey = "make";
  let data = { ...empty };
  const answers: [string, StepKey][] = [
    ["Skoda", "model"],
    ["Octavia", "year"],
    ["2016", "registration"],
    ["123 abc", "vin"],
    ["skip", "mileage"],
    ["145 000 km", "fuel"],
    ["Diesel", "transmission"],
    ["manual", "service"],
    ["I don't know", "defects"],
    ["Small dent on rear bumper", "price"],
    ["€8,500", "location"],
    ["Tartu", "photos"],
    ["done", "name"],
    ["Jane Example", "contact"],
    ["jane@example.com, +372 5555 0100", "summary"],
  ];
  for (const [text, expected] of answers) {
    const out = processAnswer(step, data, text, 0);
    assert.equal(out.nextStep, expected, `answer "${text}" at ${step}`);
    data = { ...data, ...out.updates };
    step = out.nextStep;
  }
  assert.equal(data.registration, "123 ABC");
  assert.equal(data.vin, null);
  assert.equal(data.mileageKm, 145000);
  assert.equal(data.serviceHistory, "Unknown");
  assert.equal(data.askingPriceEur, 8500);
  assert.equal(data.email, "jane@example.com");
  assert.equal(data.phone, "+372 5555 0100");
  assert.deepEqual(missingForSubmission(data), []);
});

check("invalid answers keep the current step and explain the problem", () => {
  const cases: [StepKey, string, RegExp][] = [
    ["year", "2099", /future/],
    ["year", "1850", /between/],
    ["year", "sometime", /four digits/],
    ["mileage", "-5", /negative/],
    ["mileage", "90000 miles", /kilometres/],
    ["price", "-100", /negative/],
    ["price", "a lot", /number of euros/],
    ["vin", "WVWZZZ1KZ6W00000", /exactly 17/],
    ["vin", "WVWZZZ1KZ6W0000O0", /I, O or Q/],
    ["contact", "jane@example", /email/],
    ["contact", "call me maybe", /at least one/],
    ["make", "I don't know", /needed/],
    ["photos", "hello", /Attach File/],
  ];
  for (const [step, text, pattern] of cases) {
    const out = processAnswer(step, empty, text, 0);
    assert.equal(out.accepted, false, `${step}: "${text}" should be rejected`);
    assert.equal(out.nextStep, step);
    assert.match(out.reply, pattern);
  }
});

check("validators accept valid structured values", () => {
  assert.deepEqual(validateVin("WVWZZZ1KZ6W000001"), { ok: true, value: "WVWZZZ1KZ6W000001" });
  assert.deepEqual(validateYear(String(new Date().getFullYear())), { ok: true, value: new Date().getFullYear() });
  assert.equal(parseAmount("120k"), 120000);
  assert.equal(parseAmount("12.500"), 12500);
  assert.equal(parseAmount("1,5k"), 1500);
  assert.deepEqual(parseContact("+372 5123 4567"), { ok: true, value: { email: null, phone: "+372 5123 4567" } });
});

check("summary edits keep at least one contact method", () => {
  const data = { ...empty, email: "jane@example.com", phone: null };
  assert.equal(validateFieldEdit(data, "email", "").ok, false);
  assert.equal(validateFieldEdit({ ...data, phone: "+372 5555 0100" }, "email", "").ok, true);
  assert.equal(validateFieldEdit(data, "email", "not-an-email").ok, false);
  assert.equal(validateFieldEdit(data, "mileageKm", "-1").ok, false);
});

check("replies never contain an automatic offer", () => {
  const out = processAnswer("price", empty, "9000", 0);
  assert.doesNotMatch(out.reply, /we (will|can) (offer|pay)|our offer/i);
});

check("math persona evaluates arithmetic safely", () => {
  assert.equal(evaluateArithmetic("(12 + 8) * 3 / 4"), 15);
  assert.equal(evaluateArithmetic("2^10"), 1024);
  assert.equal(evaluateArithmetic("process.exit()"), null);
});

console.log(`\n${passed} checks passed.`);
