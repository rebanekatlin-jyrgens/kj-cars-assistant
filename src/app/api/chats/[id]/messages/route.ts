import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { ApiError, handler, readJson, type RouteParams } from "@/lib/server/http";
import { getOrCreateVisitorId } from "@/lib/server/visitor";
import { assertChatOwner, enquiryData, loadChatDto, sellerTitle } from "@/lib/server/chats";
import { parseSettings } from "@/lib/server/settings";
import { simulateReply } from "@/lib/server/simulate";
import { isStepKey, processAnswer, questionFor } from "@/lib/seller/flow";
import { MAX_MESSAGE_LENGTH } from "@/lib/shared";

export const dynamic = "force-dynamic";

type Body = { text?: unknown; model?: unknown; settings?: { temperature?: unknown; topP?: unknown } };

// Saves the user's message, produces the assistant reply and saves it too.
export const POST = handler(async (request: Request, { params }: RouteParams) => {
  const visitorId = await getOrCreateVisitorId();
  const { id } = await params;
  const body = await readJson<Body>(request);

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) throw new ApiError(400, "Please type a message before sending.");
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new ApiError(400, `Messages can be up to ${MAX_MESSAGE_LENGTH.toLocaleString("en-GB")} characters. Yours has ${text.length.toLocaleString("en-GB")}.`);
  }

  const chat = await assertChatOwner(visitorId, id);
  const settings = await parseSettings(visitorId, {
    model: body.model,
    temperature: body.settings?.temperature,
    topP: body.settings?.topP,
  });
  const model = settings.model ?? chat.model;
  const temperature = settings.temperature ?? chat.temperature;
  const topP = settings.topP ?? chat.topP;

  // Explicit timestamps keep user/assistant ordering stable.
  const userAt = new Date();
  const assistantAt = new Date(userAt.getTime() + 1);

  await prisma.$transaction(async (tx) => {
    let reply: string;
    let title: string | undefined;

    if (chat.enquiry && chat.enquiry.status === "Draft") {
      const enquiry = await tx.vehicleEnquiry.findUniqueOrThrow({
        where: { id: chat.enquiry.id },
        include: { _count: { select: { attachments: true } } },
      });
      const step = isStepKey(enquiry.step) ? enquiry.step : "make";
      const outcome = processAnswer(step, enquiryData(enquiry), text, enquiry._count.attachments);
      // Optimistic concurrency: only advance if no other tab answered this step meanwhile.
      const updated = await tx.vehicleEnquiry.updateMany({
        where: { id: enquiry.id, step: enquiry.step, status: "Draft" },
        data: { ...outcome.updates, step: outcome.nextStep },
      });
      if (updated.count !== 1) {
        throw new ApiError(409, "This conversation was updated in another window or device. Please reload to see the latest version.");
      }
      reply = outcome.reply;
      if (outcome.updates.make !== undefined || outcome.updates.model !== undefined) {
        title = sellerTitle({ ...enquiryData(enquiry), ...outcome.updates });
      }
    } else if (chat.enquiry) {
      reply = questionFor("submitted");
    } else {
      const prompt = chat.systemPrompt;
      reply = simulateReply(
        text,
        prompt ? { name: prompt.name, content: prompt.content, slug: prompt.slug ?? prompt.basedOn?.slug ?? null } : null,
        model,
        temperature,
        topP,
      );
      if (chat.title === "New chat") title = text.replace(/\s+/g, " ").slice(0, 48) + (text.length > 48 ? "..." : "");
    }

    await tx.message.create({ data: { chatId: id, role: "user", content: text, createdAt: userAt } });
    await tx.message.create({ data: { chatId: id, role: "assistant", content: reply, createdAt: assistantAt } });
    await tx.chatSession.update({ where: { id }, data: { ...settings, ...(title ? { title } : {}) } });
  });

  return NextResponse.json({ chat: await loadChatDto(visitorId, id) });
});
