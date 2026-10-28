"use client";

import { useEffect, useRef } from "react";
import { Eraser, Paperclip, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_MESSAGE_LENGTH } from "@/lib/shared";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: (text: string) => void;
  onClear: () => void;
  onAttach: (files: FileList) => void;
  quickReplies: string[];
  disabled: boolean;
  canAttach: boolean;
  attachHint: string;
  canClear: boolean;
};

export function Composer({ value, onChange, onSend, onClear, onAttach, quickReplies, disabled, canAttach, attachHint, canClear }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tooLong = value.length > MAX_MESSAGE_LENGTH;
  const canSend = !disabled && value.trim().length > 0 && !tooLong;

  // Auto-expand up to ~8 lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const send = () => {
    if (canSend) onSend(value.trim());
  };

  return (
    <div className="border-t border-slate-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        {quickReplies.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2" aria-label="Suggested answers">
            {quickReplies.map((q) => (
              <button
                key={q}
                type="button"
                disabled={disabled}
                onClick={() => onSend(q)}
                className="min-h-9 rounded-full border border-blue-200 bg-blue-50 px-3.5 text-sm font-medium text-blue-900 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className={cn("flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-sm focus-within:ring-2", tooLong ? "border-red-400 focus-within:ring-red-200" : "border-slate-300 focus-within:border-blue-800 focus-within:ring-blue-800/15")}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => fileRef.current?.click()}
            disabled={!canAttach}
            aria-label="Attach File"
            title={attachHint}
          >
            <Paperclip className="!size-5" />
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) onAttach(e.target.files);
              e.target.value = "";
            }}
          />
          <label htmlFor="message-input" className="sr-only">Message</label>
          <textarea
            id="message-input"
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type your message..."
            className="max-h-[200px] min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none sm:text-sm"
            aria-invalid={tooLong}
            aria-describedby="composer-help"
            enterKeyHint="send"
          />
          <Button type="button" size="icon" className="shrink-0 rounded-xl" onClick={send} disabled={!canSend} aria-label="Send">
            <SendHorizontal className="!size-5" />
          </Button>
        </div>
        <div id="composer-help" className="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className={cn(tooLong && "font-medium text-red-700")}>
            {tooLong
              ? `Too long: ${value.length.toLocaleString("en-GB")} / ${MAX_MESSAGE_LENGTH.toLocaleString("en-GB")} characters`
              : value.length > MAX_MESSAGE_LENGTH - 300
                ? `${value.length.toLocaleString("en-GB")} / ${MAX_MESSAGE_LENGTH.toLocaleString("en-GB")} characters`
                : <span className="hidden sm:inline">Enter to send, Shift+Enter for a new line</span>}
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-600" onClick={onClear} disabled={!canClear}>
            <Eraser /> Clear Chat
          </Button>
        </div>
      </div>
    </div>
  );
}
