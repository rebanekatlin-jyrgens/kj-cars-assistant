import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { ApiError, handler, type RouteParams } from "@/lib/server/http";
import { getOrCreateVisitorId } from "@/lib/server/visitor";
import { assertChatOwner, loadChatDto, startSellerWorkflow } from "@/lib/server/chats";

export const dynamic = "force-dynamic";

// Starts the "Sell My Car" workflow inside an existing, empty chat.
export const POST = handler(async (_request: Request, { params }: RouteParams) => {
  const visitorId = await getOrCreateVisitorId();
  const { id } = await params;
  const chat = await assertChatOwner(visitorId, id);
  if (chat.enquiry) return NextResponse.json({ chat: await loadChatDto(visitorId, id) });

  const messageCount = await prisma.message.count({ where: { chatId: id } });
  if (messageCount > 0) throw new ApiError(409, "This chat already has messages. Start a new chat to sell your car.");

  await prisma.$transaction((tx) => startSellerWorkflow(tx, visitorId, id));
  return NextResponse.json({ chat: await loadChatDto(visitorId, id) }, { status: 201 });
});
