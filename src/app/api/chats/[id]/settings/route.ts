import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, readJson, type RouteParams } from "@/lib/server/http";
import { getOrCreateVisitorId } from "@/lib/server/visitor";
import { assertChatOwner } from "@/lib/server/chats";
import { parseSettings } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

// Saves the model, system prompt, temperature and top-p for one chat.
export const PUT = handler(async (request: Request, { params }: RouteParams) => {
  const visitorId = await getOrCreateVisitorId();
  const { id } = await params;
  await assertChatOwner(visitorId, id);
  const data = await parseSettings(visitorId, await readJson(request));
  const chat = await prisma.chatSession.update({
    where: { id },
    data,
    select: { model: true, systemPromptId: true, temperature: true, topP: true },
  });
  return NextResponse.json({ settings: chat });
});
