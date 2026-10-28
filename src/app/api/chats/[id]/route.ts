import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, type RouteParams } from "@/lib/server/http";
import { getOrCreateVisitorId } from "@/lib/server/visitor";
import { assertChatOwner, loadChatDto } from "@/lib/server/chats";

export const dynamic = "force-dynamic";

export const GET = handler(async (_request: Request, { params }: RouteParams) => {
  const visitorId = await getOrCreateVisitorId();
  const { id } = await params;
  return NextResponse.json({ chat: await loadChatDto(visitorId, id) });
});

// Deletes the conversation, its messages and any unsubmitted enquiry with its photos.
// A submitted enquiry is kept (its chatId becomes null through the SetNull relation).
export const DELETE = handler(async (_request: Request, { params }: RouteParams) => {
  const visitorId = await getOrCreateVisitorId();
  const { id } = await params;
  await assertChatOwner(visitorId, id);
  await prisma.$transaction([
    prisma.vehicleEnquiry.deleteMany({ where: { chatId: id, visitorId, status: "Draft" } }),
    prisma.chatSession.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
});
