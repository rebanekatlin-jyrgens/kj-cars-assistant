import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, type RouteParams } from "@/lib/server/http";
import { getOrCreateVisitorId } from "@/lib/server/visitor";
import { assertChatOwner, loadChatDto, startSellerWorkflow } from "@/lib/server/chats";

export const dynamic = "force-dynamic";

// Clears all messages. An unsubmitted enquiry (answers and photos) is reset and the
// questions start again. A submitted enquiry is never changed.
export const POST = handler(async (_request: Request, { params }: RouteParams) => {
  const visitorId = await getOrCreateVisitorId();
  const { id } = await params;
  const chat = await assertChatOwner(visitorId, id);

  await prisma.$transaction(async (tx) => {
    await tx.message.deleteMany({ where: { chatId: id } });
    if (!chat.enquiry) {
      await tx.chatSession.update({ where: { id }, data: { title: "New chat" } });
    } else if (chat.enquiry.status === "Draft") {
      await tx.vehicleEnquiry.delete({ where: { id: chat.enquiry.id } });
      await startSellerWorkflow(tx, visitorId, id);
    } else {
      const enquiry = await tx.vehicleEnquiry.findUniqueOrThrow({ where: { id: chat.enquiry.id }, select: { reference: true } });
      await tx.message.create({
        data: {
          chatId: id,
          role: "assistant",
          content: `The messages in this chat were cleared. Your submitted enquiry (reference ${enquiry.reference}) has not been changed.`,
        },
      });
    }
  });

  return NextResponse.json({ chat: await loadChatDto(visitorId, id) });
});
