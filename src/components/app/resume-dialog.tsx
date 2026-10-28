"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form";
import { createResumeLink } from "@/lib/client/api";
import { formatTime } from "@/lib/utils";

export function ResumeDialog({ open, onOpenChange, chatId }: { open: boolean; onOpenChange: (o: boolean) => void; chatId: string | null }) {
  const [link, setLink] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await createResumeLink(chatId);
      // The token goes in the URL fragment: browsers never send it to the server or to link-preview bots.
      const params = new URLSearchParams({ token: result.token });
      if (result.chatId) params.set("chat", result.chatId);
      const url = `${window.location.origin}/resume#${params.toString()}`;
      setLink(url);
      setExpiresAt(result.expiresAt);
      setQr(await QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#0f172a", light: "#ffffff" } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The link could not be created.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setLink(null);
      setQr(null);
      setError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Continue on another device</DialogTitle>
          <DialogDescription>
            Create a private link to open your conversations on a phone or another computer.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <KeyRound className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
          <ul className="list-disc space-y-1 pl-4">
            <li>Treat this link like a password - anyone who opens it can see your chats, enquiry details and photos.</li>
            <li>It works <strong>once</strong> and expires after <strong>15 minutes</strong>.</li>
            <li>On the other device it replaces any chats previously started in that browser.</li>
          </ul>
        </div>
        {!link ? (
          <>
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
            <Button onClick={generate} disabled={loading}>{loading && <Loader2 className="animate-spin" />} Create private link</Button>
          </>
        ) : (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
            {qr && <img src={qr} alt="QR code for the private resume link" className="mx-auto size-[220px] rounded-lg border border-slate-200" />}
            <div className="flex gap-2">
              <Input readOnly value={link} aria-label="Private resume link" onFocus={(e) => e.target.select()} className="font-mono text-xs" />
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    toast.success("Link copied. Open it on your other device within 15 minutes.");
                  } catch {
                    toast.error("Copying failed. Please select the link and copy it manually.");
                  }
                }}
              >
                <Copy /> Copy
              </Button>
            </div>
            {expiresAt && <p className="text-center text-xs text-slate-500">Scan the code with your phone camera. Expires at {formatTime(expiresAt)}.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
