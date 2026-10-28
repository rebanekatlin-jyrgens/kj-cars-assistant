import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { ApiError, notFound } from "./http";
import { attachmentMeta } from "./chats";

export async function loadOwnEnquiry(visitorId: string, enquiryId: string) {
  const enquiry = await prisma.vehicleEnquiry.findFirst({
    where: { id: enquiryId, visitorId },
    include: { attachments: attachmentMeta },
  });
  if (!enquiry) throw notFound("enquiry");
  return enquiry;
}

export function assertDraft(enquiry: { status: string }) {
  if (enquiry.status !== "Draft") {
    throw new ApiError(409, "This enquiry has already been submitted and can no longer be changed.");
  }
}

// Crockford base32 without ambiguous characters.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Unique, human-friendly reference such as KJ-261028-7GQ2MX. */
export function newReference(now = new Date()): string {
  const date = now.toISOString().slice(2, 10).replace(/-/g, "");
  const bytes = randomBytes(6);
  const code = Array.from(bytes, (b) => ALPHABET[b % 32]).join("");
  return `KJ-${date}-${code}`;
}

export const confirmationText = (reference: string) =>
  `Your enquiry has been saved. Your reference is ${reference}. KJ Cars will review the information before making any offer.`;
