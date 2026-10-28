import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, readJson } from "@/lib/server/http";
import { getOrCreateVisitorId } from "@/lib/server/visitor";
import { defaultPromptId, listChats, loadChatDto, startSellerWorkflow } from "@/lib/server/chats";
import { parseSettings } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

// List the current visitor's conversations (never other visitors').
export const GET = handler(async () => {
  const visitorId = await getOrCreateVisitorId();
  return NextResponse.json({ chats: await listChats(visitorId) });
});

// Create a conversation. mode "seller" starts the guided "Sell My Car" workflow.
export const POST = handler(async (request: Request) => {
  const visitorId = await getOrCreateVisitorId();
  const body = await readJson<{ mode?: string; settings?: Record<string, unknown> }>(request);
  const settings = await parseSettings(visitorId, body.settings ?? {});
  const systemPromptId = settings.systemPromptId !== undefined ? settings.systemPromptId : await defaultPromptId(visitorId);

  const chatId = await prisma.$transaction(async (tx) => {
    const chat = await tx.chatSession.create({ data: { visitorId, ...settings, systemPromptId } });
    if (body.mode === "seller") await startSellerWorkflow(tx, visitorId, chat.id);
    return chat.id;
  });
  return NextResponse.json({ chat: await loadChatDto(visitorId, chatId) }, { status: 201 });
});
