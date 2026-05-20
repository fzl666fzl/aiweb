"use client";

import { useCallback, useEffect, useState } from "react";
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
        await apiJson("/api/auth", { method: "POST", body: JSON.stringify({}) });

        if (!cancelled) {
          await loadConversations();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "初始化访问失败，请刷新页面重试。");
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadConversations]);

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
            <div className="mx-4 mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 md:mx-8">
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
