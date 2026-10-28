"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/form";
import { createPrompt, removePrompt, updatePrompt, type PromptsResponse } from "@/lib/client/api";
import { MAX_PROMPT_CONTENT, MAX_PROMPT_NAME, type PromptDto } from "@/lib/shared";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompts: PromptDto[];
  onChanged: (result: PromptsResponse) => void;
};

type Draft = { id: string | null; name: string; content: string; isDefault: boolean };

export function PromptManager({ open, onOpenChange, prompts, onChanged }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const run = async (action: () => Promise<PromptsResponse>, success: string) => {
    setBusy(true);
    setError(null);
    try {
      onChanged(await action());
      toast.success(success);
      setDraft(null);
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The prompt could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!draft) return;
    if (draft.id) {
      run(
        () => updatePrompt(draft.id!, draft.name, draft.content),
        draft.isDefault ? "Saved as your own copy. The shared default is unchanged." : "Prompt updated.",
      );
    } else run(() => createPrompt(draft.name, draft.content), "Prompt added.");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); setDraft(null); setError(null); setConfirmDelete(null); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Prompts</DialogTitle>
          <DialogDescription>
            System prompts set the assistant&apos;s persona. Default prompts are shared templates: editing one saves a private copy for you.
            In demo mode the prompt selects a simulated persona; it does not change the guided &ldquo;Sell My Car&rdquo; workflow.
          </DialogDescription>
        </DialogHeader>

        {draft ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="prompt-name">Name</Label>
              <Input id="prompt-name" value={draft.name} maxLength={MAX_PROMPT_NAME} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prompt-content">Prompt text</Label>
              <Textarea id="prompt-content" className="min-h-40" value={draft.content} maxLength={MAX_PROMPT_CONTENT} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
              <p className="text-xs text-slate-500">{draft.content.length.toLocaleString("en-GB")} / {MAX_PROMPT_CONTENT.toLocaleString("en-GB")} characters</p>
            </div>
            {draft.isDefault && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-950">This is a shared default. Saving creates your own copy; other visitors keep the original.</p>}
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDraft(null); setError(null); }} disabled={busy}>Cancel</Button>
              <Button onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save prompt</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {prompts.map((p) => (
                <li key={p.id} className="flex items-start gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                      {p.name}
                      {p.isDefault && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">Default</span>}
                      {p.isOwn && p.basedOnId && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-800">Your copy</span>}
                      {p.isOwn && !p.basedOnId && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-800">Custom</span>}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{p.content}</p>
                    {confirmDelete === p.id && (
                      <div className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-900">
                        <p>
                          {p.basedOnId ? "Delete your copy? Chats using it will switch back to the shared default." : "Delete this prompt? Chats using it will have no prompt selected."}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="destructive" disabled={busy} onClick={() => run(() => removePrompt(p.id), "Prompt deleted.")}>
                            {busy && <Loader2 className="animate-spin" />} Delete
                          </Button>
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmDelete(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => setDraft({ id: p.id, name: p.name, content: p.content, isDefault: p.isDefault })}>
                      <Pencil />
                    </Button>
                    {p.isOwn && (
                      <Button variant="ghost" size="icon" aria-label={`Delete ${p.name}`} className="hover:text-red-700" onClick={() => setConfirmDelete(p.id)}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
            <Button variant="outline" onClick={() => setDraft({ id: null, name: "", content: "", isDefault: false })}>
              <Plus /> Add prompt
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
