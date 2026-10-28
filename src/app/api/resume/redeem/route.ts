import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { ApiError, handler, readJson } from "@/lib/server/http";
import { hashToken, issueAccessToken } from "@/lib/server/visitor";

export const dynamic = "force-dynamic";

const INVALID = "This link is invalid, has expired or has already been used. Please create a new link on your other device.";

// Redeems a resume token into a new HttpOnly access cookie for this device.
export const POST = handler(async (request: Request) => {
  const body = await readJson<{ token?: unknown }>(request);
  if (typeof body.token !== "string" || body.token.length < 20 || body.token.length > 200) throw new ApiError(400, INVALID);
  const tokenHash = hashToken(body.token);

  // Atomic one-time use: only one request can mark an unused, unexpired link as used.
  const used = await prisma.resumeLink.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (used.count !== 1) throw new ApiError(410, INVALID);

  const link = await prisma.resumeLink.findUniqueOrThrow({ where: { tokenHash }, select: { visitorId: true, chatId: true } });
  await issueAccessToken(link.visitorId);

  const chatExists = link.chatId
    ? await prisma.chatSession.count({ where: { id: link.chatId, visitorId: link.visitorId } })
    : 0;
  return NextResponse.json({ chatId: chatExists ? link.chatId : null }, { headers: { "Cache-Control": "no-store" } });
});
