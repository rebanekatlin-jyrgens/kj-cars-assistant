import type { Prisma, VehicleEnquiry } from "@prisma/client";
import { prisma } from "./db";
import { notFound } from "./http";
import { GREETING, isStepKey, questionFor, quickRepliesFor, type EnquiryData } from "../seller/flow";
import { isModelId, SELLER_PROMPT_SLUG, type ChatDto, type ChatListItem, type EnquiryDto } from "../shared";

// Never select attachment bytes when loading chats.
export const attachmentMeta = { select: { id: true, filename: true, mimeType: true, size: true }, orderBy: { createdAt: "asc" } } as const;

const chatInclude = {
  messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  enquiry: { include: { attachments: attachmentMeta } },
} satisfies Prisma.ChatSessionInclude;

type ChatWithRelations = Prisma.ChatSessionGetPayload<{ include: typeof chatInclude }>;
type EnquiryWithAttachments = Prisma.VehicleEnquiryGetPayload<{ include: { attachments: typeof attachmentMeta } }>;

export function enquiryData(e: VehicleEnquiry): EnquiryData {
  return {
    make: e.make, model: e.model, year: e.year, registration: e.registration, vin: e.vin,
    mileageKm: e.mileageKm, fuelType: e.fuelType, transmission: e.transmission,
    serviceHistory: e.serviceHistory, defects: e.defects, askingPriceEur: e.askingPriceEur,
    location: e.location, sellerName: e.sellerName, email: e.email, phone: e.phone,
  };
}

export function toEnquiryDto(e: EnquiryWithAttachments): EnquiryDto {
  const step = isStepKey(e.step) ? e.step : "make";
  return {
    ...enquiryData(e),
    id: e.id,
    step,
    status: e.status === "Submitted" ? "Submitted" : "Draft",
    reference: e.reference,
    submittedAt: e.submittedAt?.toISOString() ?? null,
    attachments: e.attachments.map((a) => ({ ...a, url: `/api/attachments/${a.id}` })),
    question: questionFor(step, enquiryData(e)),
    quickReplies: e.status === "Submitted" ? [] : quickRepliesFor(step),
  };
}

export function toChatDto(chat: ChatWithRelations): ChatDto {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
    settings: {
      model: isModelId(chat.model) ? chat.model : "claude",
      systemPromptId: chat.systemPromptId,
      temperature: chat.temperature,
      topP: chat.topP,
    },
    messages: chat.messages.map((m) => ({
      id: m.id,
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    enquiry: chat.enquiry ? toEnquiryDto(chat.enquiry) : null,
  };
}

export async function loadChatDto(visitorId: string, chatId: string): Promise<ChatDto> {
  const chat = await prisma.chatSession.findFirst({ where: { id: chatId, visitorId }, include: chatInclude });
  if (!chat) throw notFound("conversation");
  return toChatDto(chat);
}

export async function assertChatOwner(visitorId: string, chatId: string) {
  const chat = await prisma.chatSession.findFirst({
    where: { id: chatId, visitorId },
    include: { enquiry: { select: { id: true, step: true, status: true } }, systemPrompt: { include: { basedOn: { select: { slug: true } } } } },
  });
  if (!chat) throw notFound("conversation");
  return chat;
}

export async function listChats(visitorId: string): Promise<ChatListItem[]> {
  const chats = await prisma.chatSession.findMany({
    where: { visitorId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true, title: true, updatedAt: true, enquiry: { select: { status: true } } },
  });
  return chats.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt.toISOString(),
    isSeller: !!c.enquiry,
    status: c.enquiry?.status ?? null,
  }));
}

/** The visitor's own copy of the seller prompt if they edited it, otherwise the shared default. */
export async function defaultPromptId(visitorId: string): Promise<string | null> {
  const base = await prisma.systemPrompt.findUnique({ where: { slug: SELLER_PROMPT_SLUG }, select: { id: true } });
  if (!base) return null;
  const copy = await prisma.systemPrompt.findFirst({ where: { ownerId: visitorId, basedOnId: base.id }, select: { id: true } });
  return copy?.id ?? base.id;
}

/** Checks a prompt id is visible to this visitor (shared default or own). */
export async function assertPromptVisible(visitorId: string, promptId: string) {
  const prompt = await prisma.systemPrompt.findFirst({
    where: { id: promptId, OR: [{ ownerId: null }, { ownerId: visitorId }] },
    select: { id: true },
  });
  if (!prompt) throw notFound("system prompt");
}

/** Starts the seller workflow inside an (empty) chat. Returns the greeting message. */
export async function startSellerWorkflow(tx: Prisma.TransactionClient, visitorId: string, chatId: string) {
  await tx.vehicleEnquiry.create({ data: { visitorId, chatId, step: "make" } });
  await tx.chatSession.update({ where: { id: chatId }, data: { title: "Sell my car" } });
  await tx.message.create({ data: { chatId, role: "assistant", content: GREETING } });
}

export function sellerTitle(data: Pick<EnquiryData, "make" | "model">) {
  return data.make ? `Sell: ${[data.make, data.model].filter(Boolean).join(" ")}`.slice(0, 80) : "Sell my car";
}
