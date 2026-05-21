"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
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
  const [accessCode, setAccessCode] = useState("");
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [needsAccess, setNeedsAccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(isCelebrityApp);
  const [personasCollapsed, setPersonasCollapsed] = useState(isCelebrityApp);
  const closeHistoryButtonRef = useRef<HTMLButtonElement>(null);
  const selectedPersona = personas.find((persona) => persona.id === selectedPersonaId) ?? personas[0];
  const brandIcon = isCelebrityApp ? "名" : "慢";
  const brandSubtitle = isCelebrityApp ? "选择视角，拆解问题" : "给同学们的安静小空间";
  const personaPickerId = `${appId}-persona-picker`;

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

  async function submitAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = accessCode.trim();

    if (!code) {
      setError("请输入访问密码。");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await apiJson("/api/auth", { method: "POST", body: JSON.stringify({ code }) });
      setNeedsAccess(false);
      setAccessCode("");
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "访问验证失败，请重试。");
    } finally {
      setLoading(false);
    }
  }

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
        <form
          className="w-full max-w-sm rounded-lg border border-stone-200 bg-[#fffdf8] p-6 shadow-sm"
          onSubmit={submitAccess}
        >
          <div className="mb-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">
              {brandIcon}
            </div>
            <h1 className="text-xl font-semibold text-stone-950">欢迎回来，{title}</h1>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              这是给少量同学使用的 AI 小站，输入访问密码后进入。
            </p>
          </div>
          <label className="sr-only" htmlFor="access-username">
            用户名
          </label>
          <input
            autoComplete="username"
            className="sr-only"
            id="access-username"
            name="username"
            readOnly
            tabIndex={-1}
            type="text"
            value="shared-access"
          />
          <label className="block" htmlFor="access-code">
            <span className="mb-2 block text-sm font-medium text-stone-700">访问密码</span>
            <input
              className="h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              id="access-code"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="请输入访问密码"
              type="password"
              autoComplete="current-password"
              disabled={loading}
            />
          </label>
          {error ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="mt-5 h-11 w-full rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "验证中..." : "进入小站"}
          </button>
        </form>
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
                brandIcon={brandIcon}
                brandTitle={title}
                brandSubtitle={brandSubtitle}
                headerAction={
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
                }
              />
            </div>
          </div>
        ) : null}
        {historyCollapsed ? (
          <aside
            aria-label="历史对话"
            className="hidden h-full w-16 shrink-0 flex-col items-center border-r border-stone-200 bg-[#fffdf8]/90 px-2 py-4 backdrop-blur md:flex"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white shadow-sm">
              {brandIcon}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                aria-label="展开历史对话"
                title="展开历史对话"
                onClick={() => setHistoryCollapsed(false)}
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
          <div className="hidden min-h-0 shrink-0 md:block">
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onSelect={selectConversation}
              onCreate={createConversation}
              onDelete={deleteConversation}
              className={isCelebrityApp ? "h-full w-72 border-r border-stone-200" : undefined}
              brandIcon={brandIcon}
              brandTitle={title}
              brandSubtitle={brandSubtitle}
              headerAction={
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-950 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  aria-label="收起历史对话"
                  title="收起历史对话"
                  onClick={() => setHistoryCollapsed(true)}
                >
                  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              }
            />
          </div>
        )}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-[#fffdf8]/90 px-4 backdrop-blur md:px-8">
            <button
              type="button"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 md:hidden"
              aria-label="打开历史对话"
              onClick={() => setHistoryOpen(true)}
            >
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <path d="M5 7h14M5 12h14M5 17h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              历史
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold text-stone-950">{title}</h1>
              <p className="truncate text-xs text-stone-500">{subtitle}</p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {statusLabel}
            </span>
          </header>
          {personas.length > 1 ? (
            <section
              aria-label="选择名人顾问"
              className="shrink-0 border-b border-stone-200 bg-[#fffdf8]/80 px-4 py-3 md:px-8"
            >
              <div className="mx-auto max-w-6xl">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    {selectedPersona ? (
                      <>
                        <p className="text-xs font-medium text-stone-500">当前视角：{selectedPersona.name}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-stone-900">
                          {selectedPersona.description}
                        </p>
                        <p className="mt-1 truncate text-xs text-stone-500">{selectedPersona.suitableFor}</p>
                      </>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    aria-controls={personaPickerId}
                    aria-expanded={!personasCollapsed}
                    onClick={() => setPersonasCollapsed((value) => !value)}
                  >
                    {personasCollapsed ? "展开人物" : "收起人物"}
                    <svg
                      aria-hidden="true"
                      className={`h-4 w-4 transition ${personasCollapsed ? "" : "rotate-180"}`}
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                {!personasCollapsed ? (
                  <div id={personaPickerId} className="mt-3 max-h-64 overflow-y-auto pr-1">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {personas.map((persona) => {
                        const active = persona.id === selectedPersonaId;
                        return (
                          <button
                            key={persona.id}
                            type="button"
                            aria-pressed={active}
                            className={`rounded-lg border px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
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
                    {selectedPersona ? (
                      <p className="mt-2 text-xs leading-5 text-stone-500">
                        来源：{selectedPersona.source}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
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
