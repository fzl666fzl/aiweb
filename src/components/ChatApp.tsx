"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { apiJson } from "@/lib/client-api";
import type { ChatMessage, ConversationSummary } from "@/lib/types";
import { Composer } from "./Composer";
import { ConversationList } from "./ConversationList";
import { MessageList } from "./MessageList";

type RawConversation = {
  id: string;
  title: string;
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
  return { id: item.id, title: item.title, createdAt: item.created_at, updatedAt: item.updated_at };
}

function mapMessage(item: RawMessage): ChatMessage {
  return { id: item.id, role: item.role, content: item.content, createdAt: item.created_at };
}

export function ChatApp() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [needsAccess, setNeedsAccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const closeHistoryButtonRef = useRef<HTMLButtonElement>(null);

  const loadConversations = useCallback(async () => {
    const data = await apiJson<{ conversations: RawConversation[] }>("/api/conversations");
    setConversations(data.conversations.map(mapConversation));
  }, []);

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
      body: JSON.stringify({}),
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

  async function sendMessage(content: string) {
    setLoading(true);
    setError("");
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((items) => [...items, optimistic]);

    try {
      const data = await apiJson<{
        conversationId: string;
        assistantMessage: { role: "assistant"; content: string; createdAt: string };
      }>("/api/chat", { method: "POST", body: JSON.stringify({ conversationId: activeId, message: content }) });
      setActiveId(data.conversationId);
      setMessages((items) => [
        ...items,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.assistantMessage.content,
          createdAt: data.assistantMessage.createdAt,
        },
      ]);
      await loadConversations();
    } catch (err) {
      setMessages((items) => items.filter((item) => item.id !== optimistic.id));
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
              慢
            </div>
            <h1 className="text-xl font-semibold text-stone-950">欢迎回来，慢慢说</h1>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              这是给少量同学使用的陪伴小站，输入访问密码后进入。
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
        <div className="hidden min-h-0 shrink-0 md:block">
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={selectConversation}
            onCreate={createConversation}
            onDelete={deleteConversation}
          />
        </div>
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
              <h1 className="text-base font-semibold text-stone-950">慢慢说</h1>
              <p className="truncate text-xs text-stone-500">不急，想到哪里就从哪里开始。</p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              陪你在
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
          <MessageList messages={messages} loading={loading} onPromptSelect={setDraft} />
          <Composer disabled={loading} onSend={sendMessage} value={draft} onChange={setDraft} />
        </section>
      </div>
    </main>
  );
}
