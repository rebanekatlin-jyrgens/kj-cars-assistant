"use client";

import { useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/form";
import { ClientError, submitEnquiry, updateEnquiryField } from "@/lib/client/api";
import { FIELD_LABELS, FUEL_TYPES, SELLER_FIELDS, TRANSMISSIONS, VEHICLE_FIELDS, type EditableField } from "@/lib/seller/flow";
import type { ChatDto, EnquiryDto } from "@/lib/shared";
import { formatDateTime } from "@/lib/utils";
import { PhotoGrid, type PendingUpload } from "./photos";

function display(field: EditableField, e: EnquiryDto): string {
  const v = e[field];
  if (v === null || v === "") return "Not provided";
  if (field === "mileageKm") return `${(v as number).toLocaleString("en-GB")} km`;
  if (field === "askingPriceEur") return `€${(v as number).toLocaleString("en-GB")}`;
  return String(v);
}

function FieldRow({ field, enquiry, editable, onSaved }: { field: EditableField; enquiry: EnquiryDto; editable: boolean; onSaved: (e: EnquiryDto) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const label = FIELD_LABELS[field];
  const long = field === "serviceHistory" || field === "defects";
  const options = field === "fuelType" ? FUEL_TYPES : field === "transmission" ? TRANSMISSIONS : null;

  const start = () => {
    const current = enquiry[field];
    setValue(current === null ? (options ? options[0] : "") : String(current));
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await updateEnquiryField(enquiry.id, field, value));
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "This field could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const inputId = `edit-${field}`;
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {editing ? <label htmlFor={inputId}>{label}</label> : label}
          </dt>
          {!editing && <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-900">{display(field, enquiry)}</dd>}
        </div>
        {editable && !editing && (
          <Button variant="ghost" size="sm" onClick={start} aria-label={`Edit ${label}`}>
            <Pencil /> <span className="hidden sm:inline">Edit</span>
          </Button>
        )}
      </div>
      {editing && (
        <dd className="mt-2 space-y-2">
          {options ? (
            <Select id={inputId} value={value} onChange={(e) => setValue(e.target.value)}>
              {options.map((o) => <option key={o}>{o}</option>)}
            </Select>
          ) : long ? (
            <Textarea id={inputId} value={value} onChange={(e) => setValue(e.target.value)} maxLength={1000} />
          ) : (
            <Input
              id={inputId}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              inputMode={field === "year" || field === "mileageKm" || field === "askingPriceEur" ? "numeric" : field === "phone" ? "tel" : field === "email" ? "email" : undefined}
              autoFocus
              aria-invalid={!!error}
              aria-describedby={error ? `${inputId}-error` : undefined}
            />
          )}
          {error && <p id={`${inputId}-error`} className="text-sm text-red-700" role="alert">{error}</p>}
          {(field === "vin" || field === "email" || field === "phone") && <p className="text-xs text-slate-500">Leave empty to remove this value.</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>{saving && <Loader2 className="animate-spin" />} Save</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
          </div>
        </dd>
      )}
    </div>
  );
}

type Props = {
  enquiry: EnquiryDto;
  uploads: PendingUpload[];
  onEnquiryChange: (e: EnquiryDto) => void;
  onChatChange: (c: ChatDto) => void;
  onAddPhotos: (files: FileList) => void;
  onRemovePhoto: (id: string) => Promise<void>;
  onDismissUpload: (key: string) => void;
};

export function SummaryCard({ enquiry, uploads, onEnquiryChange, onChatChange, onAddPhotos, onRemovePhoto, onDismissUpload }: Props) {
  const [accurate, setAccurate] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const submitted = enquiry.status === "Submitted";
  const editable = !submitted;
  const uploading = uploads.some((u) => !u.error);

  const submit = async () => {
    // Guard against double clicks before React re-renders; the server is idempotent as well.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitEnquiry(enquiry.id);
      onEnquiryChange(result.enquiry);
      if (result.chat) onChatChange(result.chat);
      toast.success(result.message);
    } catch (e) {
      setError(e instanceof ClientError ? e.message : "Your enquiry could not be submitted. Please try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto my-4 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="summary-heading">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-4 sm:px-6">
        <div>
          <h2 id="summary-heading" className="text-lg font-semibold text-slate-900">Enquiry summary</h2>
          <p className="text-sm text-slate-500">{submitted ? "Submitted - this enquiry can no longer be edited." : "Please check every detail before submitting."}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${submitted ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
          {submitted ? "Submitted" : "Draft"}
        </span>
      </header>

      {submitted && enquiry.reference && (
        <div className="mx-4 mt-4 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 sm:mx-6" role="status">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden />
          <div>
            <p>
              Your enquiry has been saved. Your reference is <strong className="font-mono">{enquiry.reference}</strong>. KJ Cars will review the information before making any offer.
            </p>
            {enquiry.submittedAt && <p className="mt-1 text-emerald-800">Submitted {formatDateTime(enquiry.submittedAt)}</p>}
          </div>
        </div>
      )}

      <div className="grid gap-x-8 px-4 sm:px-6 md:grid-cols-2">
        <div>
          <h3 className="pt-4 text-sm font-semibold text-blue-900">Vehicle</h3>
          <dl>{VEHICLE_FIELDS.map((f) => <FieldRow key={f} field={f} enquiry={enquiry} editable={editable} onSaved={onEnquiryChange} />)}</dl>
        </div>
        <div>
          <h3 className="pt-4 text-sm font-semibold text-blue-900">Seller</h3>
          <dl>{SELLER_FIELDS.map((f) => <FieldRow key={f} field={f} enquiry={enquiry} editable={editable} onSaved={onEnquiryChange} />)}</dl>

          <div className="flex items-center justify-between pt-4">
            <h3 className="text-sm font-semibold text-blue-900">Photos ({enquiry.attachments.length}/8)</h3>
            {editable && enquiry.attachments.length + uploads.filter((u) => !u.error).length < 8 && (
              <>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <ImagePlus /> Add photos
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) onAddPhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </>
            )}
          </div>
          <PhotoGrid attachments={enquiry.attachments} uploads={uploads} editable={editable} onRemove={onRemovePhoto} onDismissUpload={onDismissUpload} className="py-3" />
          {enquiry.attachments.length === 0 && uploads.length === 0 && <p className="pb-3 text-sm text-slate-500">No photos added.</p>}
        </div>
      </div>

      {!submitted && (
        <footer className="space-y-3 border-t border-slate-200 px-4 py-4 sm:px-6">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-800">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-blue-900" checked={accurate} onChange={(e) => setAccurate(e.target.checked)} />
            I confirm that the information in this enquiry is accurate to the best of my knowledge.
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-800">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-blue-900" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            KJ Cars may contact me about this enquiry using the contact details above.
          </label>
          <p className="text-xs text-slate-500">
            Submitting does not guarantee an offer or purchase. KJ Cars will determine any offer after reviewing the information and inspecting the vehicle.
          </p>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
          <Button size="lg" className="w-full sm:w-auto" onClick={submit} disabled={!accurate || !consent || submitting || uploading}>
            {submitting ? <Loader2 className="animate-spin" /> : <Send />}
            {submitting ? "Submitting..." : "Submit Enquiry"}
          </Button>
          {uploading && <p className="text-xs text-slate-500">Please wait for photo uploads to finish.</p>}
        </footer>
      )}
    </section>
  );
}
