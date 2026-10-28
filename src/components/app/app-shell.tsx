"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import * as client from "@/lib/client/api";
import { ClientError } from "@/lib/client/api";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, PHOTO_TYPES } from "@/lib/seller/flow";
import { SELLER_PROMPT_SLUG, type ChatDto, type ChatListItem, type ChatSettings, type EnquiryDto, type MessageDto, type PromptDto } from "@/lib/shared";
import { Composer } from "./composer";
import { ConfirmDialog } from "./confirm-dialog";
import { MessageBubble, TypingIndicator } from "./message-list";
import { PhotoGrid, type PendingUpload } from "./photos";
import { PromptManager } from "./prompt-manager";
import { ResumeDialog } from "./resume-dialog";
import { Sidebar } from "./sidebar";
import { SummaryCard } from "./summary-card";
import { TopBar } from "./top-bar";
import { DemoNotice, Welcome } from "./welcome";

const DEFAULT_SETTINGS: ChatSettings = { model: "claude", systemPromptId: null, temperature: 0.7, topP: 1 };

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

function setUrlChat(id: string | null) {
  const url = id ? `/?chat=${encodeURIComponent(id)}` : "/";
  window.history.replaceState(null, "", url);
}

export function AppShell() {
  const searchParams = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(() => searchParams.get("chat"));
  const [chat, setChat] = useState<ChatDto | null>(null);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [prompts, setPrompts] = useState<PromptDto[]>([]);
  const [draftSettings, setDraftSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [booting, setBooting] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<MessageDto | null>(null);
  const [starting, setStarting] = useState(false);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatListItem | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePatch = useRef<{ chatId: string; patch: Partial<ChatSettings> } | null>(null);

  const refreshChats = useCallback(async () => {
    try {
      setChats(await client.listChats());
    } catch {
      // The sidebar keeps its last known state; the main action already reported any error.
    }
  }, []);

  const openChat = useCallback(async (id: string | null) => {
    setActiveId(id);
    setUrlChat(id);
    setSidebarOpen(false);
    setUploads([]);
    setPending(null);
    if (!id) {
      setChat(null);
      return;
    }
    setChatLoading(true);
    try {
      setChat(await client.getChat(id));
      setLoadError(null);
    } catch (e) {
      if (e instanceof ClientError && e.status === 404) {
        toast.error("That conversation no longer exists or isn't available in this browser.");
        setActiveId(null);
        setUrlChat(null);
        setChat(null);
      } else setLoadError(errorMessage(e, "The conversation could not be loaded."));
    } finally {
      setChatLoading(false);
    }
  }, []);

  const boot = useCallback(async () => {
    setBooting(true);
    setLoadError(null);
    try {
      const [chatList, promptList] = await Promise.all([client.listChats(), client.listPrompts()]);
      setChats(chatList);
      setPrompts(promptList);
      const seller = promptList.find((p) => p.slug === SELLER_PROMPT_SLUG);
      setDraftSettings((s) => ({ ...s, systemPromptId: s.systemPromptId ?? seller?.id ?? null }));
      if (activeId) await openChat(activeId);
    } catch (e) {
      setLoadError(errorMessage(e, "KJ Cars Assistant could not load."));
    } finally {
      setBooting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount (and on manual retry)
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat?.messages.length, pending, chat?.enquiry?.step]);

  // ---- settings -----------------------------------------------------------
  const settings = chat?.settings ?? draftSettings;

  const flushSettings = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const job = savePatch.current;
    savePatch.current = null;
    if (job) {
      client.saveSettings(job.chatId, job.patch).catch((e) => toast.error(errorMessage(e, "Your settings could not be saved.")));
    }
  }, []);

  const changeSettings = (patch: Partial<ChatSettings>) => {
    if (!chat) {
      setDraftSettings((s) => ({ ...s, ...patch }));
      return;
    }
    setChat({ ...chat, settings: { ...chat.settings, ...patch } });
    if (savePatch.current && savePatch.current.chatId !== chat.id) flushSettings();
    savePatch.current = { chatId: chat.id, patch: { ...savePatch.current?.patch, ...patch } };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSettings, 400);
  };

  // ---- chat actions -------------------------------------------------------
  const adoptChat = (next: ChatDto) => {
    setChat(next);
    setActiveId(next.id);
    setUrlChat(next.id);
    refreshChats();
  };

  const sellMyCar = async () => {
    setStarting(true);
    setSidebarOpen(false);
    flushSettings();
    try {
      const next = chat && !chat.enquiry && chat.messages.length === 0
        ? await client.startSeller(chat.id)
        : await client.createChat("seller", draftSettings);
      setUploads([]);
      adoptChat(next);
    } catch (e) {
      toast.error(errorMessage(e, "The enquiry could not be started. Please try again."));
    } finally {
      setStarting(false);
    }
  };

  const send = async (text: string) => {
    if (pending) return;
    flushSettings();
    const optimistic: MessageDto = { id: "pending", role: "user", content: text, createdAt: new Date().toISOString() };
    setPending(optimistic);
    setInput("");
    try {
      const target = chat ?? (await client.createChat("general", draftSettings));
      if (!chat) {
        setChat(target);
        setActiveId(target.id);
        setUrlChat(target.id);
      }
      const next = await client.sendMessage(target.id, text, target.settings.model, {
        temperature: target.settings.temperature,
        topP: target.settings.topP,
      });
      setChat(next);
      refreshChats();
    } catch (e) {
      // Keep the customer's text so nothing is lost; saved progress on the server is unchanged.
      setInput((current) => current || text);
      toast.error(errorMessage(e, "Your message could not be sent."));
      if (e instanceof ClientError && e.status === 409 && chat) openChat(chat.id);
    } finally {
      setPending(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await client.deleteChat(deleteTarget.id);
      setChats((list) => list.filter((c) => c.id !== deleteTarget.id));
      if (deleteTarget.id === activeId) await openChat(null);
      toast.success("Conversation deleted.");
    } catch (e) {
      toast.error(errorMessage(e, "The conversation could not be deleted."));
      throw e;
    }
  };

  const confirmClear = async () => {
    if (!chat) return;
    try {
      setUploads([]);
      setChat(await client.clearChat(chat.id));
      refreshChats();
      toast.success("Chat cleared.");
    } catch (e) {
      toast.error(errorMessage(e, "The chat could not be cleared."));
      throw e;
    }
  };

  // ---- photos -------------------------------------------------------------
  const setEnquiry = (update: (e: EnquiryDto) => EnquiryDto) =>
    setChat((c) => (c?.enquiry ? { ...c, enquiry: update(c.enquiry) } : c));

  const addPhotos = (files: FileList) => {
    const enquiry = chat?.enquiry;
    if (!enquiry || enquiry.status !== "Draft") return;
    let slots = MAX_PHOTOS - enquiry.attachments.length - uploads.filter((u) => !u.error).length;
    for (const file of Array.from(files)) {
      if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
        toast.error(`"${file.name}" is not a JPEG, PNG or WebP image.`);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        toast.error(`"${file.name}" is larger than 5 MB. Please choose a smaller image.`);
        continue;
      }
      if (slots <= 0) {
        toast.error(`You can add up to ${MAX_PHOTOS} photos. Remove one to add another.`);
        break;
      }
      slots--;
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const previewUrl = URL.createObjectURL(file);
      setUploads((u) => [...u, { key, name: file.name, previewUrl, progress: 0, error: null }]);
      client
        .uploadPhoto(enquiry.id, file, (progress) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress } : x))))
        .then((attachment) => {
          setUploads((u) => u.filter((x) => x.key !== key));
          URL.revokeObjectURL(previewUrl);
          setEnquiry((e) => ({ ...e, attachments: [...e.attachments, attachment] }));
        })
        .catch((e) => {
          const message = errorMessage(e, "The photo could not be uploaded.");
          setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: message } : x)));
          toast.error(message);
        });
    }
  };

  const removePhoto = async (id: string) => {
    try {
      await client.deleteAttachment(id);
      setEnquiry((e) => ({ ...e, attachments: e.attachments.filter((a) => a.id !== id) }));
    } catch (e) {
      toast.error(errorMessage(e, "The photo could not be removed."));
    }
  };

  const dismissUpload = (key: string) =>
    setUploads((u) => {
      const item = u.find((x) => x.key === key);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return u.filter((x) => x.key !== key);
    });

  // ---- render -------------------------------------------------------------
  const enquiry = chat?.enquiry ?? null;
  const inSummary = enquiry && (enquiry.step === "summary" || enquiry.step === "submitted");
  const canAttach = !!enquiry && enquiry.status === "Draft" && !pending;
  const busy = !!pending || starting || chatLoading;

  const clearDescription = !chat ? null : !enquiry ? (
    <p>All messages in this conversation will be permanently removed. The chat itself and its settings are kept.</p>
  ) : enquiry.status === "Draft" ? (
    <>
      <p>All messages in this conversation will be permanently removed.</p>
      <p>Your unsubmitted car enquiry will also be reset: all answers and {enquiry.attachments.length} uploaded photo{enquiry.attachments.length === 1 ? "" : "s"} will be deleted and the questions will start again.</p>
    </>
  ) : (
    <p>All messages in this conversation will be permanently removed. Your submitted enquiry ({enquiry.reference}) is not affected and stays saved.</p>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <Sidebar
        chats={chats}
        loading={booting}
        activeId={activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={(id) => openChat(id)}
        onNewChat={() => openChat(null)}
        onSellMyCar={sellMyCar}
        onDelete={setDeleteTarget}
        onContinueElsewhere={() => { setSidebarOpen(false); setResumeOpen(true); }}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={chat?.title ?? "New chat"}
          onMenu={() => setSidebarOpen(true)}
          onManagePrompts={() => setPromptsOpen(true)}
          settings={settings}
          prompts={prompts}
          onChange={changeSettings}
          settingsOpen={settingsOpen}
          onSettingsOpenChange={setSettingsOpen}
          hasChat={!!chat}
        />

        <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
          {loadError ? (
            <div className="mx-auto mt-16 max-w-md px-4 text-center">
              <AlertTriangle className="mx-auto size-10 text-amber-600" aria-hidden />
              <h2 className="mt-3 text-lg font-semibold text-slate-900">Something went wrong</h2>
              <p className="mt-2 text-sm text-slate-600">{loadError}</p>
              <Button className="mt-5" onClick={() => (activeId && !booting ? openChat(activeId) : boot())}>
                <RefreshCw /> Try again
              </Button>
            </div>
          ) : booting || (chatLoading && !chat) ? (
            <div className="flex h-full items-center justify-center text-slate-500">
              <Loader2 className="mr-2 size-5 animate-spin" /> Loading...
            </div>
          ) : !chat || (chat.messages.length === 0 && !pending && !chat.enquiry) ? (
            <Welcome onSell={sellMyCar} busy={starting} />
          ) : (
            <div className="mx-auto w-full max-w-3xl px-3 py-5 sm:px-6">
              {enquiry && <DemoNotice className="mb-5" />}
              <ol className="space-y-4" aria-label="Conversation">
                {chat.messages.map((m) => <MessageBubble key={m.id} message={m} />)}
                {pending && <MessageBubble message={pending} pending />}
                {pending && <TypingIndicator />}
              </ol>
              {inSummary && enquiry && (
                <SummaryCard
                  enquiry={enquiry}
                  uploads={uploads}
                  onEnquiryChange={(e) => { setEnquiry(() => e); refreshChats(); }}
                  onChatChange={(c) => { setChat(c); refreshChats(); }}
                  onAddPhotos={addPhotos}
                  onRemovePhoto={removePhoto}
                  onDismissUpload={dismissUpload}
                />
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {!inSummary && enquiry && (enquiry.attachments.length > 0 || uploads.length > 0) && (
          <div className="border-t border-slate-200 bg-white px-3 pt-3 sm:px-6">
            <div className="mx-auto max-w-3xl">
              <p className="mb-2 text-xs font-medium text-slate-600">Vehicle photos ({enquiry.attachments.length}/{MAX_PHOTOS})</p>
              <PhotoGrid attachments={enquiry.attachments} uploads={uploads} editable={enquiry.status === "Draft"} onRemove={removePhoto} onDismissUpload={dismissUpload} className="grid-cols-5 sm:grid-cols-8 md:grid-cols-8" />
            </div>
          </div>
        )}

        {!loadError && !booting && (
          <Composer
            value={input}
            onChange={setInput}
            onSend={send}
            onClear={() => setClearOpen(true)}
            onAttach={addPhotos}
            quickReplies={enquiry && enquiry.status === "Draft" && !inSummary ? enquiry.quickReplies : []}
            disabled={busy}
            canAttach={canAttach}
            attachHint={canAttach ? "Attach vehicle photos (JPEG, PNG or WebP, up to 5 MB each)" : "Photos can be attached during the Sell My Car workflow."}
            canClear={!!chat && !busy && (chat.messages.length > 0 || !!enquiry)}
          />
        )}
      </main>

      <PromptManager
        open={promptsOpen}
        onOpenChange={setPromptsOpen}
        prompts={prompts}
        onChanged={(result) => {
          setPrompts(result.prompts);
          const swap = (id: string | null) =>
            result.replacedId && result.prompt && id === result.replacedId ? result.prompt.id
            : id && result.restoredId !== undefined && !result.prompts.some((p) => p.id === id) ? result.restoredId
            : id;
          setDraftSettings((s) => ({ ...s, systemPromptId: swap(s.systemPromptId) }));
          setChat((c) => (c ? { ...c, settings: { ...c.settings, systemPromptId: swap(c.settings.systemPromptId) } } : c));
        }}
      />
      <ResumeDialog open={resumeOpen} onOpenChange={setResumeOpen} chatId={chat?.id ?? null} />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete conversation?"
        description={
          <>
            <p>&ldquo;{deleteTarget?.title}&rdquo; and all its messages will be permanently deleted.</p>
            {deleteTarget?.isSeller && (
              <p>
                {deleteTarget.status === "Submitted"
                  ? "Your submitted enquiry is kept by KJ Cars, but you will no longer see it in this chat history."
                  : "The unsubmitted car enquiry in this chat, including its answers and photos, will also be deleted."}
              </p>
            )}
          </>
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
      <ConfirmDialog open={clearOpen} onOpenChange={setClearOpen} title="Clear this chat?" description={clearDescription} confirmLabel="Clear Chat" onConfirm={confirmClear} />
    </div>
  );
}
