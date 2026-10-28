import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";

export const ACCESS_COOKIE = "kj_access";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export function newToken(): string {
  return randomBytes(32).toString("base64url"); // 256 bits of entropy
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function setAccessCookie(token: string) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/** Issue a new device token for a visitor and store it in the cookie. */
export async function issueAccessToken(visitorId: string) {
  const token = newToken();
  await prisma.accessToken.create({ data: { visitorId, tokenHash: hashToken(token) } });
  await setAccessCookie(token);
}

/** Returns the current visitor id, or null when the browser has no valid access cookie. */
export async function findVisitorId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  const record = await prisma.accessToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, visitorId: true, lastSeenAt: true },
  });
  if (!record) return null;
  // Refresh lastSeenAt at most once per hour.
  if (Date.now() - record.lastSeenAt.getTime() > 60 * 60 * 1000) {
    await prisma.accessToken.update({ where: { id: record.id }, data: { lastSeenAt: new Date() } });
  }
  return record.visitorId;
}

/** Returns the current visitor id, creating a new anonymous visitor if needed. */
export async function getOrCreateVisitorId(): Promise<string> {
  const existing = await findVisitorId();
  if (existing) return existing;
  const visitor = await prisma.visitor.create({ data: {} });
  await issueAccessToken(visitor.id);
  return visitor.id;
}
