import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, readJson } from "@/lib/server/http";
import { getOrCreateVisitorId, hashToken, newToken } from "@/lib/server/visitor";
import { assertChatOwner } from "@/lib/server/chats";

export const dynamic = "force-dynamic";

const RESUME_LINK_MINUTES = 15;

// Creates a private, one-time, expiring "Continue on another device" token.
// Only its hash is stored. The browser builds the link with the token in the URL fragment,
// so it is never sent to servers or link-preview bots when the link is opened.
export const POST = handler(async (request: Request) => {
  const visitorId = await getOrCreateVisitorId();
  const body = await readJson<{ chatId?: unknown }>(request).catch(() => ({ chatId: undefined }));
  const chatId = typeof body.chatId === "string" ? body.chatId : null;
  if (chatId) await assertChatOwner(visitorId, chatId);

  const token = newToken();
  const expiresAt = new Date(Date.now() + RESUME_LINK_MINUTES * 60 * 1000);
  await prisma.resumeLink.create({ data: { visitorId, chatId, tokenHash: hashToken(token), expiresAt } });
  return NextResponse.json({ token, chatId, expiresAt: expiresAt.toISOString() }, { headers: { "Cache-Control": "no-store" } });
});
