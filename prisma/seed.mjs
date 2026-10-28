// Idempotent seed for the shared default system prompts.
// Safe to run on every deploy: prompts are upserted by slug and never duplicated.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_PROMPTS = [
  {
    slug: "kj-cars-seller-assistant",
    name: "KJ Cars Seller Assistant",
    content:
      "You are the KJ Cars Assistant. Help car owners submit a vehicle sale enquiry to KJ Cars by asking one question at a time. " +
      "Never invent vehicle specifications, history or condition. Never claim to have checked external registries, accident records or market prices. " +
      "Never make or promise a purchase offer: KJ Cars decides on any offer after reviewing the enquiry and inspecting the vehicle.",
  },
  {
    slug: "coder",
    name: "Coder",
    content:
      "You are an experienced software engineer. Give concise, correct answers with short code examples and explain trade-offs.",
  },
  {
    slug: "writer",
    name: "Writer",
    content:
      "You are a professional writer and editor. Help the user draft, structure and polish clear, friendly English text.",
  },
  {
    slug: "math",
    name: "Math",
    content:
      "You are a patient mathematics tutor. Solve problems step by step and show your working.",
  },
];

async function main() {
  for (const prompt of DEFAULT_PROMPTS) {
    await prisma.systemPrompt.upsert({
      where: { slug: prompt.slug },
      // Do not overwrite existing default content on redeploys.
      update: { isDefault: true, ownerId: null },
      create: { ...prompt, isDefault: true },
    });
  }
  console.log(`Seed complete: ${DEFAULT_PROMPTS.length} default prompts present.`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
