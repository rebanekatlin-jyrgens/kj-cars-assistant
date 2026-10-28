import { Car, ClipboardCheck, Info, Loader2, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/form";

export function DemoNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-950 ${className}`}>
      <Info className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
      <p>
        <Badge className="mr-1 align-middle">Demo mode</Badge> The assistant uses a guided workflow and simulated AI responses.
        No real AI model is called, and the model and settings choices are for demonstration only.
      </p>
    </div>
  );
}

export function Welcome({ onSell, busy, onChat }: { onSell: () => void; busy: boolean; onChat?: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-10 text-center sm:py-16">
      <span className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-blue-900 text-white shadow-lg shadow-blue-900/20">
        <Car className="size-8" aria-hidden />
      </span>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Sell your car to KJ Cars</h1>
      <p className="mt-4 max-w-xl text-base text-slate-600 sm:text-lg">
        Tell us about your vehicle. Our assistant will guide you through the details so our team can review your enquiry.
      </p>
      <Button size="lg" className="mt-8 w-full max-w-xs" onClick={onSell} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Car />} Sell My Car
      </Button>
      {onChat && (
        <Button variant="link" className="mt-2" onClick={onChat}>
          <MessageSquare /> Or start a general chat
        </Button>
      )}

      <div className="mt-10 grid w-full gap-3 text-left sm:grid-cols-2">
        <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-blue-800" aria-hidden />
          <p>
            <strong className="text-slate-900">No guaranteed offer.</strong> Submitting an enquiry does not guarantee an offer or purchase.
            KJ Cars will determine any offer after reviewing the information and inspecting the vehicle.
          </p>
        </div>
        <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-blue-800" aria-hidden />
          <p>
            <strong className="text-slate-900">Private to you.</strong> Your conversations are only visible in this browser, or on a device you link
            with &ldquo;Continue on another device&rdquo;.
          </p>
        </div>
      </div>
      <DemoNotice className="mt-3 w-full" />
    </div>
  );
}
