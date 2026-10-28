"use client";

import { Car, CheckCircle2, MessageSquare, Plus, Smartphone, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import type { ChatListItem } from "@/lib/shared";

type Props = {
  chats: ChatListItem[];
  loading: boolean;
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onSellMyCar: () => void;
  onDelete: (chat: ChatListItem) => void;
  onContinueElsewhere: () => void;
};

export function Sidebar({ chats, loading, activeId, open, onClose, onSelect, onNewChat, onSellMyCar, onDelete, onContinueElsewhere }: Props) {
  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn("fixed inset-0 z-30 bg-slate-900/40 transition-opacity lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={onClose}
        aria-hidden
      />
      <aside
        id="chat-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[280px] max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:z-auto lg:w-[260px] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Chat history"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-blue-900 text-white">
              <Car className="size-5" aria-hidden />
            </span>
            <div className="leading-tight">
              <p className="font-semibold text-slate-900">KJ Cars</p>
              <p className="text-xs text-slate-500">Assistant</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose} aria-label="Close menu">
            <X />
          </Button>
        </div>

        <div className="space-y-2 px-3 py-3">
          <Button className="w-full" onClick={onNewChat}>
            <Plus /> New Chat
          </Button>
          <Button variant="outline" className="w-full" onClick={onSellMyCar}>
            <Car /> Sell My Car
          </Button>
        </div>

        <h2 className="px-4 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Chat History</h2>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {loading && chats.length === 0 ? (
            <div className="space-y-2 px-2" aria-label="Loading chats">
              {[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          ) : chats.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-500">No conversations yet. Your chats are private to this browser.</p>
          ) : (
            <ul className="space-y-1">
              {chats.map((chat) => (
                <li key={chat.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(chat.id)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-lg py-2.5 pl-2.5 pr-11 text-left text-sm transition-colors",
                      chat.id === activeId ? "bg-blue-50 text-blue-950" : "text-slate-700 hover:bg-slate-100",
                    )}
                    aria-current={chat.id === activeId ? "page" : undefined}
                  >
                    {chat.status === "Submitted" ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Submitted enquiry" />
                    ) : chat.isSeller ? (
                      <Car className="mt-0.5 size-4 shrink-0 text-blue-800" aria-hidden />
                    ) : (
                      <MessageSquare className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{chat.title}</span>
                      <span className="block text-xs text-slate-500">{formatDateTime(chat.updatedAt)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(chat)}
                    className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 lg:opacity-0 lg:group-hover:opacity-100"
                    aria-label={`Delete conversation "${chat.title}"`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <Button variant="ghost" className="w-full justify-start" onClick={onContinueElsewhere}>
            <Smartphone /> Continue on another device
          </Button>
        </div>
      </aside>
    </>
  );
}
