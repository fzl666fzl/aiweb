"use client";

import Link from "next/link";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { apiJson } from "@/lib/client-api";
import {
  getDefaultPersonaId,
  getPersonasForApp,
  isAppId,
  isPersonaForApp,
  type AppId,
  type PersonaId,
} from "@/lib/personas";
import type { ChatMessage, ConversationSummary } from "@/lib/types";
import { AuthForm } from "./AuthForm";
import { Composer } from "./Composer";
import { ConversationList } from "./ConversationList";
import { MessageList } from "./MessageList";

type RawConversation = {
  id: string;
  title: string;
  app_id: string;
  persona_id: string;
  created_at: string;
  updated_at: string;
};

type RawMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

function mapConversation(item: RawConversation): ConversationSummary {
  const appId = isAppId(item.app_id) ? item.app_id : "mamanshuo";
  const personaId = isPersonaForApp(item.persona_id, appId) ? item.persona_id : getDefaultPersonaId(appId);

  return {
    id: item.id,
    title: item.title,
    appId,
    personaId,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

function mapMessage(item: RawMessage): ChatMessage {
  return { id: item.id, role: item.role, content: item.content, createdAt: item.created_at };
}

type ChatStreamEvent = {
  event: string;
  data: Record<string, unknown>;
};

async function* readChatEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      buffer += decoder.decode();
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const event = parseChatEvent(block);

      if (event) {
        yield event;
      }
    }
  }

  if (buffer) {
    const event = parseChatEvent(buffer);

    if (event) {
      yield event;
    }
  }
}

function parseChatEvent(block: string): ChatStreamEvent | null {
  let event = "message";
  let data = "";

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    }

    if (line.startsWith("data:")) {
      data += line.slice(5).trim();
    }
  }

  if (!data) {
    return null;
  }

  return { event, data: JSON.parse(data) };
}

type ChatAppProps = {
  appId?: AppId;
  title?: string;
  subtitle?: string;
  statusLabel?: string;
};

const CELEBRITY_SIDEBAR_WIDTH_KEY = "celebrities-sidebar-width";
const DEFAULT_CELEBRITY_SIDEBAR_WIDTH = 288;
const MIN_CELEBRITY_SIDEBAR_WIDTH = 240;
const MAX_CELEBRITY_SIDEBAR_WIDTH = 440;

function clampSidebarWidth(width: number) {
  return Math.min(MAX_CELEBRITY_SIDEBAR_WIDTH, Math.max(MIN_CELEBRITY_SIDEBAR_WIDTH, Math.round(width)));
}

function HomeLink({ className, showLabel = false }: { className: string; showLabel?: boolean }) {
  return (
    <Link aria-label="返回首页" className={className} href="/" title="返回首页">
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
        <path
          d="M4.5 11.2 12 5l7.5 6.2M6.5 10.5V19h11v-8.5M10 19v-5h4v5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showLabel ? <span>首页</span> : null}
    </Link>
  );
}

export function ChatApp({
  appId = "mamanshuo",
  title = "慢慢说",
  subtitle = "不急，想到哪里就从哪里开始。",
  statusLabel = "陪你在",
}: ChatAppProps) {
  const personas = getPersonasForApp(appId);
  const defaultPersonaId = getDefaultPersonaId(appId);
  const isCelebrityApp = appId === "celebrities";
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] = useState<PersonaId>(defaultPersonaId);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [needsAccess, setNeedsAccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number | null>(null);
  const [resizingSidebar, setResizingSidebar] = useState(false);
  const [personasCollapsed, setPersonasCollapsed] = useState(false);
  const closeHistoryButtonRef = useRef<HTMLButtonElement>(null);
  const selectedPersona = personas.find((persona) => persona.id === selectedPersonaId) ?? personas[0];
  const brandIcon = isCelebrityApp ? "名" : "慢";
  const brandSubtitle = isCelebrityApp ? "选择视角，拆解问题" : "给同学们的安静小空间";
  const personaPickerId = `${appId}-persona-picker`;
  const resolvedSidebarWidth = sidebarWidth ?? DEFAULT_CELEBRITY_SIDEBAR_WIDTH;

  const loadConversations = useCallback(async () => {
    const data = await apiJson<{ conversations: RawConversation[] }>(`/api/conversations?appId=${appId}`);
    setConversations(data.conversations.map(mapConversation));
  }, [appId]);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(async () => {
      try {
        await loadConversations();
        if (!cancelled) {
          setNeedsAccess(false);
        }
      } catch {
        if (!cancelled) {
          setNeedsAccess(true);
          setError("");
        }
      } finally {
        if (!cancelled) {
          setCheckingAccess(false);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadConversations]);

  useEffect(() => {
    if (!historyOpen) {
      return;
    }

    closeHistoryButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setHistoryOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [historyOpen]);

  useEffect(() => {
    if (!isCelebrityApp) {
      return;
    }

    let cancelled = false;

    void Promise.resolve().then(() => {
      const storedWidth = Number(window.localStorage.getItem(CELEBRITY_SIDEBAR_WIDTH_KEY));

      if (!cancelled && Number.isFinite(storedWidth) && storedWidth > 0) {
        setSidebarWidth(clampSidebarWidth(storedWidth));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isCelebrityApp]);

  useEffect(() => {
    if (!isCelebrityApp || sidebarWidth === null) {
      return;
    }

    window.localStorage.setItem(CELEBRITY_SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [isCelebrityApp, sidebarWidth]);

  useEffect(() => {
    if (!resizingSidebar) {
      return;
    }

    function resizeSidebar(event: PointerEvent) {
      setSidebarWidth(clampSidebarWidth(event.clientX));
    }

    function stopResize() {
      setResizingSidebar(false);
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", resizeSidebar);
    window.addEventListener("pointerup", stopResize);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", resizeSidebar);
      window.removeEventListener("pointerup", stopResize);
    };
  }, [resizingSidebar]);

  async function selectConversation(id: string) {
    const conversation = conversations.find((item) => item.id === id);
    if (conversation) {
      setSelectedPersonaId(conversation.personaId);
    }

    setActiveId(id);
    setDraft("");
    setError("");
    const data = await apiJson<{ messages: RawMessage[] }>(`/api/conversations/${id}/messages`);
    setMessages(data.messages.map(mapMessage));
  }

  async function selectConversationFromHistory(id: string) {
    await selectConversation(id);
    setHistoryOpen(false);
  }

  async function createConversation() {
    const data = await apiJson<{ conversation: RawConversation }>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ appId, personaId: selectedPersonaId }),
    });
    const conversation = mapConversation(data.conversation);
    setConversations((items) => [conversation, ...items]);
    setActiveId(conversation.id);
    setDraft("");
    setMessages([]);
  }

  async function createConversationFromHistory() {
    await createConversation();
    setHistoryOpen(false);
  }

  async function deleteConversation(id: string) {
    await apiJson(`/api/conversations/${id}`, { method: "DELETE" });
    setConversations((items) => items.filter((item) => item.id !== id));

    if (activeId === id) {
      setActiveId(null);
      setDraft("");
      setMessages([]);
    }
  }

  function selectPersona(personaId: PersonaId) {
    if (loading || personaId === selectedPersonaId) {
      return;
    }

    setSelectedPersonaId(personaId);
    setActiveId(null);
    setDraft("");
    setMessages([]);
    setError("");

    if (isCelebrityApp) {
      setPersonasCollapsed(true);
    }
  }

  function startSidebarResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    setResizingSidebar(true);
    setSidebarWidth(clampSidebarWidth(event.clientX));
  }

  function resizeSidebarWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const step = event.shiftKey ? 48 : 24;
    setSidebarWidth((width) => clampSidebarWidth((width ?? DEFAULT_CELEBRITY_SIDEBAR_WIDTH) + direction * step));
  }

  async function sendMessage(content: string) {
    setLoading(true);
    setError("");
    const now = Date.now();
    const optimistic: ChatMessage = {
      id: `local-${now}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    const assistantId = `assistant-${now}`;
    const assistant: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };
    setMessages((items) => [...items, optimistic, assistant]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, conversationId: activeId, message: content, personaId: selectedPersonaId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "发送失败。");
      }

      if (!response.body) {
        throw new Error("AI 服务暂时不可用，请稍后重试。");
      }

      let assistantContent = "";

      for await (const streamEvent of readChatEvents(response.body)) {
        if (streamEvent.event === "conversation" && typeof streamEvent.data.conversationId === "string") {
          setActiveId(streamEvent.data.conversationId);
          if (isPersonaForApp(streamEvent.data.personaId, appId)) {
            setSelectedPersonaId(streamEvent.data.personaId);
          }
        }

        if (streamEvent.event === "delta" && typeof streamEvent.data.content === "string") {
          assistantContent += streamEvent.data.content;
          setMessages((items) =>
            items.map((item) => (item.id === assistantId ? { ...item, content: assistantContent } : item)),
          );
        }

        if (streamEvent.event === "done" && typeof streamEvent.data.createdAt === "string") {
          setMessages((items) =>
            items.map((item) =>
              item.id === assistantId ? { ...item, createdAt: streamEvent.data.createdAt as string } : item,
            ),
          );
        }

        if (streamEvent.event === "error") {
          throw new Error(typeof streamEvent.data.message === "string" ? streamEvent.data.message : "发送失败。");
        }
      }

      if (!assistantContent.trim()) {
        throw new Error("AI 服务返回为空，请稍后重试。");
      }

      await loadConversations();
    } catch (err) {
      setMessages((items) => items.filter((item) => item.id !== optimistic.id && item.id !== assistantId));
      setError(err instanceof Error ? err.message : "发送失败。");
    } finally {
      setLoading(false);
    }
  }

  const personaPanel =
    personas.length > 1 ? (
      <section aria-label="人物视角" className="mb-4 border-b border-stone-200 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {selectedPersona ? (
              <>
                <p className="text-xs font-medium text-stone-500">当前视角：{selectedPersona.name}</p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-stone-950">
                  {selectedPersona.description}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">{selectedPersona.suitableFor}</p>
              </>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            aria-controls={personaPickerId}
            aria-expanded={!personasCollapsed}
            onClick={() => setPersonasCollapsed((value) => !value)}
          >
            {personasCollapsed ? "展开人物" : "收起人物"}
            <svg
              aria-hidden="true"
              className={`h-3.5 w-3.5 transition ${personasCollapsed ? "" : "rotate-180"}`}
              viewBox="0 0 24 24"
              fill="none"
            >
              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {!personasCollapsed ? (
          <div id={personaPickerId} className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {personas.map((persona) => {
              const active = persona.id === selectedPersonaId;
              return (
                <button
                  key={persona.id}
                  type="button"
                  aria-pressed={active}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                    active
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : "border-stone-200 bg-white text-stone-700 hover:border-emerald-200 hover:bg-emerald-50/60"
                  }`}
                  onClick={() => selectPersona(persona.id)}
                >
                  <span className="block truncate text-sm font-semibold">{persona.name}</span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-stone-500">
                    {persona.description}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>
    ) : null;

  if (checkingAccess) {
    return (
      <main className="flex h-dvh items-center justify-center bg-[#f7f2e8] px-4 text-stone-900">
        <div className="text-sm text-stone-500">正在检查访问权限...</div>
      </main>
    );
  }

  if (needsAccess) {
    return (
      <main className="flex h-dvh items-center justify-center bg-[#f7f2e8] px-4 text-stone-900">
        <AuthForm
          brandIcon={brandIcon}
          title={`欢迎回来，${title}`}
          onAuthenticated={async () => {
            setNeedsAccess(false);
            await loadConversations();
          }}
        />
      </main>
    );
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-[#f7f2e8] text-stone-900">
      <div className="flex min-h-0 w-full flex-col md:flex-row">
        {historyOpen ? (
          <div
            className="fixed inset-0 z-50 flex bg-stone-950/35 md:hidden"
            onClick={() => setHistoryOpen(false)}
          >
            <div
              aria-label="历史对话"
              aria-modal="true"
              className="h-full w-[min(22rem,calc(100vw-2rem))]"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <ConversationList
                conversations={conversations}
                activeId={activeId}
                onSelect={selectConversationFromHistory}
                onCreate={createConversationFromHistory}
                onDelete={deleteConversation}
                className="h-full w-full border-r border-stone-200"
                ariaLabel={isCelebrityApp ? "人物和历史侧栏" : "历史对话"}
                topContent={isCelebrityApp ? personaPanel : null}
                brandIcon={brandIcon}
                brandTitle={title}
                brandSubtitle={brandSubtitle}
                headerAction={
                  <div className="flex shrink-0 items-center gap-1">
                    <HomeLink className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-950 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                    <button
                      ref={closeHistoryButtonRef}
                      type="button"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-950 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      aria-label="关闭历史对话"
                      onClick={() => setHistoryOpen(false)}
                    >
                      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                }
              />
            </div>
          </div>
        ) : null}
        {sidebarCollapsed ? (
          <aside
            aria-label="折叠侧栏"
            className="hidden h-full w-16 shrink-0 flex-col items-center border-r border-stone-200 bg-[#fffdf8]/90 px-2 py-4 backdrop-blur md:flex"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white shadow-sm">
              {brandIcon}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <HomeLink className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                aria-label="展开侧栏"
                title="展开侧栏"
                onClick={() => setSidebarCollapsed(false)}
              >
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <path d="M4 7h12M4 12h16M4 17h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                aria-label="新建对话"
                title="新建对话"
                onClick={createConversation}
              >
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </aside>
        ) : (
          <div
            className={isCelebrityApp ? "relative hidden min-h-0 shrink-0 md:block" : "hidden min-h-0 shrink-0 md:block"}
            style={isCelebrityApp ? { width: `${resolvedSidebarWidth}px` } : undefined}
          >
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onSelect={selectConversation}
              onCreate={createConversation}
              onDelete={deleteConversation}
              className={isCelebrityApp ? "h-full w-full border-r border-stone-200" : undefined}
              ariaLabel={isCelebrityApp ? "人物和历史侧栏" : "历史对话"}
              topContent={isCelebrityApp ? personaPanel : null}
              brandIcon={brandIcon}
              brandTitle={title}
              brandSubtitle={brandSubtitle}
              headerAction={
                <div className="flex shrink-0 items-center gap-1">
                  <HomeLink className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-950 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-950 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    aria-label="收起侧栏"
                    title="收起侧栏"
                    onClick={() => setSidebarCollapsed(true)}
                  >
                    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              }
            />
            {isCelebrityApp ? (
              <div
                aria-label="调整侧栏宽度"
                aria-orientation="vertical"
                aria-valuemax={MAX_CELEBRITY_SIDEBAR_WIDTH}
                aria-valuemin={MIN_CELEBRITY_SIDEBAR_WIDTH}
                aria-valuenow={resolvedSidebarWidth}
                className="absolute inset-y-0 -right-1 z-10 hidden w-2 cursor-col-resize touch-none items-center justify-center focus:outline-none focus:ring-2 focus:ring-emerald-200 md:flex"
                role="separator"
                tabIndex={0}
                onKeyDown={resizeSidebarWithKeyboard}
                onPointerDown={startSidebarResize}
              >
                <span
                  className={
                    resizingSidebar
                      ? "h-10 w-1 rounded-full bg-emerald-500"
                      : "h-10 w-1 rounded-full bg-stone-300 transition hover:bg-emerald-400"
                  }
                />
              </div>
            ) : null}
          </div>
        )}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-[#fffdf8]/90 px-4 backdrop-blur md:px-8">
            <button
              type="button"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 md:hidden"
              aria-label={isCelebrityApp ? "打开人物和历史侧栏" : "打开历史对话"}
              onClick={() => setHistoryOpen(true)}
            >
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <path d="M5 7h14M5 12h14M5 17h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              {isCelebrityApp ? "侧栏" : "历史"}
            </button>
            <HomeLink
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 md:hidden"
              showLabel
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold text-stone-950">{title}</h1>
              <p className="truncate text-xs text-stone-500">{subtitle}</p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {statusLabel}
            </span>
          </header>
          {error ? (
            <div
              className="mx-4 mt-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:mx-8"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          <MessageList
            messages={messages}
            loading={loading}
            onPromptSelect={setDraft}
            emptyIcon={brandIcon}
            emptyTitle={isCelebrityApp ? "把问题交给一个视角来拆解" : undefined}
            emptyDescription={isCelebrityApp ? "先选一位顾问，再写下你想分析的选择、困惑或计划。" : undefined}
            showPromptCards={!isCelebrityApp}
          />
          <Composer
            disabled={loading}
            onSend={sendMessage}
            value={draft}
            onChange={setDraft}
            placeholder={isCelebrityApp ? "写下你想请这个视角分析的问题..." : undefined}
            showScenarioTemplates={!isCelebrityApp}
          />
        </section>
      </div>
    </main>
  );
}
