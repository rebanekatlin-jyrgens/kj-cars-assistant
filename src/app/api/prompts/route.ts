import { NextResponse } from "next/server";
import type { SystemPrompt } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { ApiError, handler, notFound, readJson } from "@/lib/server/http";
import { getOrCreateVisitorId } from "@/lib/server/visitor";
import { MAX_PROMPT_CONTENT, MAX_PROMPT_NAME, SELLER_PROMPT_SLUG, type PromptDto } from "@/lib/shared";

export const dynamic = "force-dynamic";

const DEFAULT_ORDER = [SELLER_PROMPT_SLUG, "coder", "writer", "math"];

function toDto(p: SystemPrompt & { basedOn?: { slug: string | null } | null }, visitorId: string): PromptDto {
  return {
    id: p.id,
    name: p.name,
    content: p.content,
    isDefault: p.isDefault,
    isOwn: p.ownerId === visitorId,
    basedOnId: p.basedOnId,
    slug: p.slug ?? p.basedOn?.slug ?? null,
  };
}

function parsePrompt(body: { name?: unknown; content?: unknown }) {
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!name) throw new ApiError(400, "Please give the prompt a name.");
  if (name.length > MAX_PROMPT_NAME) throw new ApiError(400, `Prompt names can be up to ${MAX_PROMPT_NAME} characters.`);
  if (!content) throw new ApiError(400, "Please enter the prompt text.");
  if (content.length > MAX_PROMPT_CONTENT) throw new ApiError(400, `Prompt text can be up to ${MAX_PROMPT_CONTENT.toLocaleString("en-GB")} characters.`);
  return { name, content };
}

/** Shared defaults (unless the visitor has their own edited copy) plus the visitor's own prompts. */
async function listPrompts(visitorId: string): Promise<PromptDto[]> {
  const [defaults, own] = await Promise.all([
    prisma.systemPrompt.findMany({ where: { ownerId: null }, include: { basedOn: { select: { slug: true } } } }),
    prisma.systemPrompt.findMany({ where: { ownerId: visitorId }, include: { basedOn: { select: { slug: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  const copiedIds = new Set(own.map((p) => p.basedOnId).filter(Boolean));
  const rank = (slug: string | null | undefined) => {
    const i = DEFAULT_ORDER.indexOf(slug ?? "");
    return i === -1 ? DEFAULT_ORDER.length : i;
  };
  const visibleDefaults = defaults.filter((d) => !copiedIds.has(d.id));
  const copies = own.filter((p) => p.basedOnId);
  const custom = own.filter((p) => !p.basedOnId);
  const slugOf = (p: (typeof own)[number]) => p.slug ?? p.basedOn?.slug;
  const templates = [...visibleDefaults, ...copies].sort((a, b) => rank(slugOf(a)) - rank(slugOf(b)));
  return [...templates, ...custom].map((p) => toDto(p, visitorId));
}

export const GET = handler(async () => {
  const visitorId = await getOrCreateVisitorId();
  return NextResponse.json({ prompts: await listPrompts(visitorId) });
});

export const POST = handler(async (request: Request) => {
  const visitorId = await getOrCreateVisitorId();
  const data = parsePrompt(await readJson(request));
  const prompt = await prisma.systemPrompt.create({ data: { ...data, ownerId: visitorId } });
  return NextResponse.json({ prompt: toDto(prompt, visitorId), prompts: await listPrompts(visitorId) }, { status: 201 });
});

// Editing a shared default creates (or updates) a visitor-owned copy; the default is never changed.
export const PUT = handler(async (request: Request) => {
  const visitorId = await getOrCreateVisitorId();
  const body = await readJson<{ id?: unknown; name?: unknown; content?: unknown }>(request);
  if (typeof body.id !== "string") throw new ApiError(400, "Please choose a prompt to edit.");
  const data = parsePrompt(body);
  const existing = await prisma.systemPrompt.findFirst({ where: { id: body.id, OR: [{ ownerId: null }, { ownerId: visitorId }] } });
  if (!existing) throw notFound("system prompt");

  let prompt: SystemPrompt;
  if (existing.ownerId === visitorId) {
    prompt = await prisma.systemPrompt.update({ where: { id: existing.id }, data });
  } else {
    prompt = await prisma.$transaction(async (tx) => {
      const copy = await tx.systemPrompt.upsert({
        where: { ownerId_basedOnId: { ownerId: visitorId, basedOnId: existing.id } },
        update: data,
        create: { ...data, ownerId: visitorId, basedOnId: existing.id },
      });
      // The visitor's chats that used the default now use their own copy.
      await tx.chatSession.updateMany({ where: { visitorId, systemPromptId: existing.id }, data: { systemPromptId: copy.id } });
      return copy;
    });
  }
  return NextResponse.json({ prompt: toDto(prompt, visitorId), replacedId: existing.id, prompts: await listPrompts(visitorId) });
});

// Only the visitor's own prompts can be deleted. Deleting an edited copy restores the shared default.
export const DELETE = handler(async (request: Request) => {
  const visitorId = await getOrCreateVisitorId();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) throw new ApiError(400, "Please choose a prompt to delete.");
  const prompt = await prisma.systemPrompt.findFirst({ where: { id, OR: [{ ownerId: null }, { ownerId: visitorId }] } });
  if (!prompt) throw notFound("system prompt");
  if (prompt.ownerId !== visitorId) {
    throw new ApiError(403, "Default prompts are shared templates and can't be deleted. You can edit one to create your own copy.");
  }
  await prisma.$transaction([
    prisma.chatSession.updateMany({ where: { visitorId, systemPromptId: id }, data: { systemPromptId: prompt.basedOnId } }),
    prisma.systemPrompt.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true, restoredId: prompt.basedOnId, prompts: await listPrompts(visitorId) });
});
