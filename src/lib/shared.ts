// Constants and API types shared by the browser and the server.
import type { EnquiryData, StepKey } from "./seller/flow";

export const MODELS = [
  { id: "gpt-4", label: "GPT-4" },
  { id: "claude", label: "Claude" },
  { id: "local-llama", label: "Local Llama" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];
export const isModelId = (v: unknown): v is ModelId => MODELS.some((m) => m.id === v);
export const modelLabel = (id: string) => MODELS.find((m) => m.id === id)?.label ?? id;

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_PROMPT_NAME = 60;
export const MAX_PROMPT_CONTENT = 4000;
export const SELLER_PROMPT_SLUG = "kj-cars-seller-assistant";
export const SIMULATED_DELAY_MS = 1500;

export type ChatSettings = { model: ModelId; systemPromptId: string | null; temperature: number; topP: number };

export type ChatListItem = { id: string; title: string; updatedAt: string; isSeller: boolean; status: string | null };

export type MessageDto = { id: string; role: "user" | "assistant"; content: string; createdAt: string };

export type AttachmentDto = { id: string; filename: string; mimeType: string; size: number; url: string };

export type EnquiryDto = EnquiryData & {
  id: string;
  step: StepKey;
  status: "Draft" | "Submitted";
  reference: string | null;
  submittedAt: string | null;
  attachments: AttachmentDto[];
  question: string;
  quickReplies: string[];
};

export type ChatDto = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  settings: ChatSettings;
  messages: MessageDto[];
  enquiry: EnquiryDto | null;
};

export type PromptDto = { id: string; name: string; content: string; isDefault: boolean; isOwn: boolean; basedOnId: string | null; slug: string | null };
