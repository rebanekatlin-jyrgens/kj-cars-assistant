import { ApiError } from "./http";
import { assertPromptVisible } from "./chats";
import { isModelId } from "../shared";

type SettingsInput = { model?: unknown; systemPromptId?: unknown; temperature?: unknown; topP?: unknown };
type SettingsUpdate = { model?: string; systemPromptId?: string | null; temperature?: number; topP?: number };

function slider(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new ApiError(400, `${label} must be a number between 0.0 and 1.0.`);
  }
  return Math.round(value * 10) / 10;
}

/** Validates chat settings from a request body. Only provided keys are returned. */
export async function parseSettings(visitorId: string, input: SettingsInput): Promise<SettingsUpdate> {
  const out: SettingsUpdate = {};
  if (input.model !== undefined) {
    if (!isModelId(input.model)) throw new ApiError(400, "Please choose GPT-4, Claude or Local Llama.");
    out.model = input.model;
  }
  if (input.temperature !== undefined) out.temperature = slider(input.temperature, "Temperature");
  if (input.topP !== undefined) out.topP = slider(input.topP, "Top-P");
  if (input.systemPromptId !== undefined) {
    if (input.systemPromptId === null) out.systemPromptId = null;
    else if (typeof input.systemPromptId === "string") {
      await assertPromptVisible(visitorId, input.systemPromptId);
      out.systemPromptId = input.systemPromptId;
    } else throw new ApiError(400, "That system prompt is not valid.");
  }
  return out;
}
