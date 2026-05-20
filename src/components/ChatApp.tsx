"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
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
      <main className="flex h-dvh items-center justify-center bg-slate-50 px-4 text-slate-900">
        <div className="text-sm text-slate-500">正在检查访问权限...</div>
      </main>
    );
  }

  if (needsAccess) {
    return (
      <main className="flex h-dvh items-center justify-center bg-slate-50 px-4 text-slate-900">
        <form
          className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={submitAccess}
        >
          <div className="mb-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-xs font-bold text-white">
              AI
            </div>
            <h1 className="text-xl font-semibold text-slate-950">输入访问密码</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">这是给少量朋友使用的问答网站，输入共享密码后即可进入。</p>
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
            <span className="mb-2 block text-sm font-medium text-slate-700">访问密码</span>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
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
            className="mt-5 h-11 w-full rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "验证中..." : "进入网站"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-slate-50 text-slate-900">
      <div className="flex min-h-0 w-full flex-col md:flex-row">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={selectConversation}
          onCreate={createConversation}
          onDelete={deleteConversation}
        />
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/85 px-4 backdrop-blur md:px-8">
            <div>
              <h1 className="text-base font-semibold text-slate-950">AI 问答助手</h1>
              <p className="text-xs text-slate-500">欢迎回来，选择一个场景开始工作。</p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              在线
            </span>
          </header>
          {error ? (
            <div
              className="mx-4 mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 md:mx-8"
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
