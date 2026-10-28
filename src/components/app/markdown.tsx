import * as React from "react";

// Minimal, safe Markdown subset for simulated replies: code fences, lists, **bold**, _italic_, `code`.
// Builds React elements only (no innerHTML), so message text can never inject HTML.

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^`[^`]+`$/.test(part)) return <code key={key} className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[0.85em]">{part.slice(1, -1)}</code>;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (/^_[^_]+_$/.test(part)) return <em key={key} className="text-slate-500">{part.slice(1, -1)}</em>;
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/```(\w*)\n?([\s\S]*?)```/g);
  const out: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (i % 3 === 1) continue; // language tag
    if (i % 3 === 2) {
      out.push(
        <pre key={`code-${i}`} className="my-2 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100">
          <code>{blocks[i].replace(/\n$/, "")}</code>
        </pre>,
      );
      continue;
    }
    const paragraphs = blocks[i].split(/\n{2,}/).filter((p) => p.trim());
    paragraphs.forEach((para, p) => {
      const lines = para.split("\n");
      const isList = lines.every((l) => /^\s*(-|\d+\.)\s/.test(l));
      const key = `p-${i}-${p}`;
      if (isList) {
        const ordered = /^\s*\d+\./.test(lines[0]);
        const items = lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*(-|\d+\.)\s/, ""), `${key}-${j}`)}</li>);
        out.push(ordered
          ? <ol key={key} className="my-1 list-decimal space-y-0.5 pl-5">{items}</ol>
          : <ul key={key} className="my-1 list-disc space-y-0.5 pl-5">{items}</ul>);
      } else {
        out.push(
          <p key={key} className="my-1 whitespace-pre-wrap first:mt-0 last:mb-0">
            {lines.map((l, j) => (
              <React.Fragment key={j}>
                {j > 0 && <br />}
                {inline(l, `${key}-${j}`)}
              </React.Fragment>
            ))}
          </p>,
        );
      }
    });
  }
  return <div className="break-words">{out}</div>;
}
