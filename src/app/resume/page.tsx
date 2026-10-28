"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Car, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { redeemResumeToken } from "@/lib/client/api";

// Redeems a "Continue on another device" link. The token arrives in the URL fragment,
// is removed from the address bar immediately, and is exchanged for an HttpOnly cookie.
export default function ResumePage() {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");
    window.history.replaceState(null, "", "/resume");
    if (!token) {
      setError("This link is incomplete. Please create a new link on your other device.");
      return;
    }
    redeemResumeToken(token)
      .then(({ chatId }) => window.location.replace(chatId ? `/?chat=${encodeURIComponent(chatId)}` : "/"))
      .catch((e) => setError(e instanceof Error ? e.message : "This link could not be used."));
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-blue-900 text-white">
          <Car className="size-6" aria-hidden />
        </span>
        {error ? (
          <>
            <XCircle className="mx-auto size-8 text-red-600" aria-hidden />
            <h1 className="mt-3 text-lg font-semibold text-slate-900">Link not valid</h1>
            <p className="mt-2 text-sm text-slate-600" role="alert">{error}</p>
            <Button asChild className="mt-6">
              <Link href="/">Go to KJ Cars Assistant</Link>
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto size-8 animate-spin text-blue-900" aria-hidden />
            <h1 className="mt-3 text-lg font-semibold text-slate-900">Connecting this device...</h1>
            <p className="mt-2 text-sm text-slate-600">Opening your KJ Cars conversations.</p>
          </>
        )}
      </div>
    </main>
  );
}
