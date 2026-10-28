"use client";

import { useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import type { AttachmentDto } from "@/lib/shared";
import { cn } from "@/lib/utils";

export type PendingUpload = { key: string; name: string; previewUrl: string; progress: number; error: string | null };

type Props = {
  attachments: AttachmentDto[];
  uploads: PendingUpload[];
  editable: boolean;
  onRemove: (id: string) => Promise<void>;
  onDismissUpload: (key: string) => void;
  className?: string;
};

export function PhotoGrid({ attachments, uploads, editable, onRemove, onDismissUpload, className }: Props) {
  const [removing, setRemoving] = useState<string | null>(null);
  if (attachments.length === 0 && uploads.length === 0) return null;
  return (
    <ul className={cn("grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-4", className)} aria-label="Vehicle photos">
      {attachments.map((a) => (
        <li key={a.id} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          <a href={a.url} target="_blank" rel="noreferrer" title={a.filename}>
            {/* eslint-disable-next-line @next/next/no-img-element -- access-controlled endpoint, not optimisable */}
            <img src={a.url} alt={`Vehicle photo ${a.filename}`} className="size-full object-cover" loading="lazy" />
          </a>
          {editable && (
            <button
              type="button"
              className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-slate-900/70 text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label={`Remove photo ${a.filename}`}
              disabled={removing === a.id}
              onClick={async () => {
                setRemoving(a.id);
                try {
                  await onRemove(a.id);
                } finally {
                  setRemoving(null);
                }
              }}
            >
              {removing === a.id ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
            </button>
          )}
        </li>
      ))}
      {uploads.map((u) => (
        <li key={u.key} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100" title={u.error ?? u.name}>
          {u.error ? (
            // No preview for failed files: they may not be images at all.
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 border border-red-200 bg-red-50 p-1 text-center">
              <AlertCircle className="size-5 shrink-0 text-red-700" aria-hidden />
              <span className="w-full truncate text-[11px] text-red-900">{u.name}</span>
              <span className="sr-only">Upload failed: {u.error}</span>
              <button type="button" className="rounded bg-white px-1.5 text-[11px] font-medium text-slate-800 shadow-sm" onClick={() => onDismissUpload(u.key)}>
                Dismiss
              </button>
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a selected file */}
              <img src={u.previewUrl} alt={`Uploading ${u.name}`} className="size-full object-cover opacity-60" />
            </>
          )}
          {!u.error && (
            <div className="absolute inset-x-1 bottom-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/80" role="progressbar" aria-valuenow={u.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${u.name}`}>
                <div className="h-full bg-blue-900 transition-all" style={{ width: `${u.progress}%` }} />
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
