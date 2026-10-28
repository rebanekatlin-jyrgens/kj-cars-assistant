"use client";

import { Car, User } from "lucide-react";
import type { MessageDto } from "@/lib/shared";
import { cn, formatTime } from "@/lib/utils";
import { Markdown } from "./markdown";

export function MessageBubble({ message, pending = false }: { message: MessageDto; pending?: boolean }) {
  const isUser = message.role === "user";
  return (
    <li className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <span
        className={cn("mt-1 flex size-8 shrink-0 items-center justify-center rounded-full", isUser ? "bg-slate-200 text-slate-700" : "bg-blue-900 text-white")}
        aria-hidden
      >
        {isUser ? <User className="size-4" /> : <Car className="size-4" />}
      </span>
      <div className={cn("flex max-w-[85%] flex-col sm:max-w-[75%]", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            // relative: keeps the sr-only label inside the bubble so it can't stretch the page height
            "relative rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm sm:text-sm",
            isUser ? "rounded-tr-sm bg-blue-900 text-white" : "rounded-tl-sm border border-slate-200 bg-white text-slate-900",
            pending && "opacity-70",
          )}
        >
          <span className="sr-only">{isUser ? "You said:" : "KJ Cars Assistant said:"}</span>
          {isUser ? <p className="whitespace-pre-wrap break-words">{message.content}</p> : <Markdown text={message.content} />}
        </div>
        <time dateTime={message.createdAt} className="mt-1 px-1 text-[11px] text-slate-500">
          {pending ? "Sending..." : formatTime(message.createdAt)}
        </time>
      </div>
    </li>
  );
}

export function TypingIndicator() {
  return (
    <li className="flex gap-2.5" aria-live="polite">
      <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-900 text-white" aria-hidden>
        <Car className="size-4" />
      </span>
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
        <span className="flex gap-1" aria-hidden>
          <span className="typing-dot size-1.5 rounded-full bg-slate-500" />
          <span className="typing-dot size-1.5 rounded-full bg-slate-500 [animation-delay:150ms]" />
          <span className="typing-dot size-1.5 rounded-full bg-slate-500 [animation-delay:300ms]" />
        </span>
        Typing...
      </div>
    </li>
  );
}
