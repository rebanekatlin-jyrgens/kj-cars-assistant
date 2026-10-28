"use client";

import { BookText, Menu, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge, Label, Select } from "@/components/ui/form";
import { Slider } from "@/components/ui/slider";
import { MODELS, type ChatSettings, type ModelId, type PromptDto } from "@/lib/shared";

type SelectorProps = {
  settings: ChatSettings;
  prompts: PromptDto[];
  onChange: (patch: Partial<ChatSettings>) => void;
  idPrefix: string;
};

function ModelAndPrompt({ settings, prompts, onChange, idPrefix }: SelectorProps) {
  return (
    <>
      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor={`${idPrefix}-model`} className="text-xs text-slate-600">
          LLM Model <span className="font-normal text-amber-700">(simulated)</span>
        </Label>
        <Select id={`${idPrefix}-model`} value={settings.model} onChange={(e) => onChange({ model: e.target.value as ModelId })} className="h-9">
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} (simulated)</option>)}
        </Select>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor={`${idPrefix}-prompt`} className="text-xs text-slate-600">System Prompt</Label>
        <Select
          id={`${idPrefix}-prompt`}
          value={settings.systemPromptId ?? ""}
          onChange={(e) => onChange({ systemPromptId: e.target.value || null })}
          className="h-9"
        >
          <option value="">None</option>
          {prompts.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isOwn && p.basedOnId ? " (your copy)" : ""}</option>)}
        </Select>
      </div>
    </>
  );
}

function Sliders({ settings, onChange }: Pick<SelectorProps, "settings" | "onChange">) {
  return (
    <div className="space-y-5">
      {([
        ["temperature", "Temperature", "Higher values would make a real model's answers more varied."],
        ["topP", "Top-P", "Limits a real model to the most likely words (nucleus sampling)."],
      ] as const).map(([key, label, help]) => (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label id={`${key}-label`}>{label}</Label>
            <output className="rounded bg-slate-100 px-2 py-0.5 font-mono text-sm text-slate-800" aria-live="polite">{settings[key].toFixed(1)}</output>
          </div>
          <Slider
            aria-labelledby={`${key}-label`}
            aria-label={label}
            min={0}
            max={1}
            step={0.1}
            value={[settings[key]]}
            onValueChange={([v]) => onChange({ [key]: Math.round(v * 10) / 10 })}
          />
          <p className="text-xs text-slate-500">{help}</p>
        </div>
      ))}
    </div>
  );
}

type Props = SelectorProps & {
  title: string;
  onMenu: () => void;
  onManagePrompts: () => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  hasChat: boolean;
};

export function TopBar({ title, onMenu, onManagePrompts, settings, prompts, onChange, settingsOpen, onSettingsOpenChange, hasChat }: Omit<Props, "idPrefix">) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu" aria-controls="chat-sidebar">
          <Menu className="!size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{title}</p>
          <p className="truncate text-xs text-slate-500">KJ Cars Assistant</p>
        </div>
        <Badge title="The assistant uses a guided workflow and simulated AI responses.">Demo mode</Badge>

        <div className="hidden items-end gap-3 xl:flex">
          <div className="grid w-[26rem] grid-cols-2 gap-3"><ModelAndPrompt idPrefix="top" settings={settings} prompts={prompts} onChange={onChange} /></div>
        </div>
        <Button variant="outline" size="sm" className="hidden xl:inline-flex" onClick={onManagePrompts}>
          <BookText /> Manage Prompts
        </Button>
        <Button variant="outline" size="sm" onClick={() => onSettingsOpenChange(true)} aria-label="Chat settings">
          <SlidersHorizontal /> <span className="hidden sm:inline">Settings</span>
        </Button>
      </div>

      <Dialog open={settingsOpen} onOpenChange={onSettingsOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chat settings</DialogTitle>
            <DialogDescription>
              {hasChat ? "Saved for this chat." : "Applied to the next chat you start."} Demo mode: these choices are simulated and do not affect the
              deterministic &ldquo;Sell My Car&rdquo; workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <ModelAndPrompt idPrefix="dialog" settings={settings} prompts={prompts} onChange={onChange} />
          </div>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => { onSettingsOpenChange(false); onManagePrompts(); }}>
            <BookText /> Manage Prompts
          </Button>
          <div className="border-t border-slate-200 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Advanced settings</h3>
            <Sliders settings={settings} onChange={onChange} />
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
