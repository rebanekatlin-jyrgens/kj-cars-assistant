// Browser-side API client. The server (PostgreSQL) is the only authoritative data store.
import { SIMULATED_DELAY_MS, type AttachmentDto, type ChatDto, type ChatListItem, type ChatSettings, type EnquiryDto, type ModelId, type PromptDto } from "../shared";

export class ClientError extends Error {
  constructor(public status: number, message: string, public data: Record<string, unknown> = {}) {
    super(message);
  }
}

const NETWORK_ERROR = "We couldn't connect to KJ Cars Assistant. Please check your internet connection and try again.";

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      credentials: "same-origin",
      headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ClientError(0, NETWORK_ERROR);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ClientError(response.status, typeof data.error === "string" ? data.error : "Something went wrong. Please try again.", data);
  }
  return data as T;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a message in a chat and resolves with the updated chat (user message + assistant reply).
 * Demo mode: no real LLM is called; the reply is simulated and arrives after about 1.5 seconds.
 */
export async function sendMessage(
  chatId: string,
  text: string,
  model: ModelId,
  settings: Pick<ChatSettings, "temperature" | "topP">,
): Promise<ChatDto> {
  const [result] = await Promise.all([
    api<{ chat: ChatDto }>(`/api/chats/${chatId}/messages`, { method: "POST", json: { text, model, settings } }),
    delay(SIMULATED_DELAY_MS),
  ]);
  return result.chat;
}

export const listChats = () => api<{ chats: ChatListItem[] }>("/api/chats").then((r) => r.chats);
export const getChat = (id: string) => api<{ chat: ChatDto }>(`/api/chats/${id}`).then((r) => r.chat);
export const createChat = (mode: "seller" | "general", settings: Partial<ChatSettings>) =>
  api<{ chat: ChatDto }>("/api/chats", { method: "POST", json: { mode, settings } }).then((r) => r.chat);
export const deleteChat = (id: string) => api(`/api/chats/${id}`, { method: "DELETE" });
export const clearChat = (id: string) => api<{ chat: ChatDto }>(`/api/chats/${id}/clear`, { method: "POST" }).then((r) => r.chat);
export const startSeller = (id: string) => api<{ chat: ChatDto }>(`/api/chats/${id}/enquiry`, { method: "POST" }).then((r) => r.chat);
export const saveSettings = (id: string, settings: Partial<ChatSettings>) =>
  api(`/api/chats/${id}/settings`, { method: "PUT", json: settings });

export const updateEnquiryField = (id: string, field: string, value: string) =>
  api<{ enquiry: EnquiryDto }>(`/api/enquiries/${id}`, { method: "PATCH", json: { field, value } }).then((r) => r.enquiry);
export const submitEnquiry = (id: string) =>
  api<{ enquiry: EnquiryDto; chat: ChatDto | null; message: string; alreadySubmitted: boolean }>(`/api/enquiries/${id}/submit`, {
    method: "POST",
    json: { confirmAccurate: true, consentContact: true },
  });
export const deleteAttachment = (id: string) => api(`/api/attachments/${id}`, { method: "DELETE" });

export type PromptsResponse = { prompts: PromptDto[]; prompt?: PromptDto; replacedId?: string; restoredId?: string | null };
export const listPrompts = () => api<PromptsResponse>("/api/prompts").then((r) => r.prompts);
export const createPrompt = (name: string, content: string) => api<PromptsResponse>("/api/prompts", { method: "POST", json: { name, content } });
export const updatePrompt = (id: string, name: string, content: string) =>
  api<PromptsResponse>("/api/prompts", { method: "PUT", json: { id, name, content } });
export const removePrompt = (id: string) => api<PromptsResponse>(`/api/prompts?id=${encodeURIComponent(id)}`, { method: "DELETE" });

export const createResumeLink = (chatId: string | null) =>
  api<{ token: string; chatId: string | null; expiresAt: string }>("/api/resume", { method: "POST", json: { chatId } });
export const redeemResumeToken = (token: string) =>
  api<{ chatId: string | null }>("/api/resume/redeem", { method: "POST", json: { token } });

/** Uploads one photo with progress reporting (fetch can't report upload progress). */
export function uploadPhoto(enquiryId: string, file: File, onProgress: (percent: number) => void): Promise<AttachmentDto> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/enquiries/${enquiryId}/attachments`);
    xhr.withCredentials = true;
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const data = (xhr.response ?? {}) as { attachment?: AttachmentDto; error?: string };
      if (xhr.status >= 200 && xhr.status < 300 && data.attachment) resolve(data.attachment);
      else reject(new ClientError(xhr.status, data.error ?? "The photo could not be uploaded. Please try again."));
    };
    xhr.onerror = () => reject(new ClientError(0, NETWORK_ERROR));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
