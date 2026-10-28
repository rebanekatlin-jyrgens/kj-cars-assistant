// Simulated (demo mode) responses for the non-workflow personas.
// No external AI service is called. Responses are deterministic templates based on the input.
import { modelLabel } from "../shared";

type Persona = { name: string; slug: string | null; content: string } | null;

function header(model: string, temperature: number, topP: number) {
  return `_Simulated ${modelLabel(model)} response (demo mode, temperature ${temperature.toFixed(1)}, top-p ${topP.toFixed(1)})._`;
}

/** Small safe arithmetic evaluator: + - * / ^ ( ) and decimals. Returns null if the input is not pure arithmetic. */
export function evaluateArithmetic(input: string): number | null {
  const src = input.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/,/g, ".");
  if (!/^[\d.+\-*/^()]+$/.test(src) || !/\d/.test(src) || src.length > 120) return null;
  let i = 0;
  const peek = () => src[i];
  const number = (): number => {
    const m = src.slice(i).match(/^\d+(\.\d+)?/);
    if (!m) throw new Error("number expected");
    i += m[0].length;
    return Number(m[0]);
  };
  const factor = (): number => {
    if (peek() === "-") { i++; return -factor(); }
    if (peek() === "+") { i++; return factor(); }
    let base: number;
    if (peek() === "(") {
      i++;
      base = expr();
      if (peek() !== ")") throw new Error(") expected");
      i++;
    } else base = number();
    if (peek() === "^") { i++; return base ** factor(); }
    return base;
  };
  const term = (): number => {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = src[i++];
      const r = factor();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = src[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  try {
    const value = expr();
    if (i !== src.length || !Number.isFinite(value)) return null;
    return Math.round(value * 1e10) / 1e10;
  } catch {
    return null;
  }
}

function coder(text: string) {
  const lower = text.toLowerCase();
  const lang = /python/.test(lower) ? "python" : /sql/.test(lower) ? "sql" : "typescript";
  const snippet =
    lang === "python"
      ? `def solve(data):\n    # TODO: implement: ${text.slice(0, 60).replace(/\n/g, " ")}\n    return data`
      : lang === "sql"
        ? `-- TODO: ${text.slice(0, 60).replace(/\n/g, " ")}\nSELECT *\nFROM your_table\nWHERE condition = true;`
        : `export function solve(input: unknown) {\n  // TODO: ${text.slice(0, 60).replace(/\n/g, " ")}\n  return input;\n}`;
  return [
    "Here is how I would approach this:",
    "1. Clarify the inputs and expected outputs.",
    "2. Write a small function and test it with a few examples.",
    "3. Handle edge cases (empty input, invalid values) explicitly.",
    "",
    "```" + lang,
    snippet,
    "```",
    "",
    "This is a template answer generated in demo mode - no real model analysed your code.",
  ].join("\n");
}

function writer(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const firstSentence = text.trim().split(/(?<=[.!?])\s/)[0].slice(0, 160);
  return [
    `Your text has ${words} word${words === 1 ? "" : "s"}. A suggested structure:`,
    "",
    `- **Opening:** state the main point clearly - "${firstSentence}"`,
    "- **Body:** support it with two or three short paragraphs, one idea each.",
    "- **Close:** end with a clear next step or takeaway.",
    "",
    "Tip: prefer short sentences and active verbs. This is a simulated writing suggestion (demo mode).",
  ].join("\n");
}

function math(text: string) {
  const expression = text.replace(/^(what\s+is|calculate|compute|solve)\s*/i, "").replace(/[?=]\s*$/, "").trim();
  const value = evaluateArithmetic(expression);
  if (value !== null) {
    return `Working:\n\n\`${expression}\` = **${value}**\n\nThe arithmetic was evaluated exactly by the demo app; the explanation itself is simulated.`;
  }
  return [
    "Let's work through it step by step:",
    "1. Write down what is known and what we need to find.",
    "2. Choose a method (equation, formula or diagram).",
    "3. Solve, then check the answer makes sense.",
    "",
    "In demo mode I can evaluate plain arithmetic such as `(12 + 8) * 3 / 4` exactly. For anything else this is a simulated response.",
  ].join("\n");
}

function seller(text: string) {
  const lower = text.toLowerCase();
  if (/offer|price|worth|value|how much/.test(lower)) {
    return "I can't estimate a price or make an offer. KJ Cars decides on any offer only after reviewing your enquiry and inspecting the vehicle. To start an enquiry, select \"Sell My Car\".";
  }
  if (/photo|picture|image/.test(lower)) {
    return "You can add up to 8 photos (JPEG, PNG or WebP, up to 5 MB each) during the \"Sell My Car\" workflow.";
  }
  return "I'm the KJ Cars Assistant. To submit your car for review, select \"Sell My Car\" and I'll guide you through the details one question at a time. Submitting an enquiry doesn't guarantee an offer or purchase.";
}

export function simulateReply(
  text: string,
  persona: Persona,
  model: string,
  temperature: number,
  topP: number,
): string {
  const top = header(model, temperature, topP);
  switch (persona?.slug) {
    case "coder": return `${top}\n\n${coder(text)}`;
    case "writer": return `${top}\n\n${writer(text)}`;
    case "math": return `${top}\n\n${math(text)}`;
    case "kj-cars-seller-assistant": return `${top}\n\n${seller(text)}`;
  }
  if (!persona) {
    return `${top}\n\nNo system prompt is selected for this chat. Choose one from "System Prompt" in the top bar. You wrote: "${text.slice(0, 200)}"`;
  }
  return `${top}\n\nResponding as **${persona.name}**. In demo mode no real model is called, so this is a placeholder reply to: "${text.slice(0, 200)}"`;
}
