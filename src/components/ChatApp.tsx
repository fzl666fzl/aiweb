"use client";

import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadConversations();
  }, []);

  async function loadConversations() {
    const data = await apiJson<{ conversations: RawConversation[] }>("/api/conversations");
    setConversations(data.conversations.map(mapConversation));
  }

  async function selectConversation(id: string) {
    setActiveId(id);
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
    setMessages([]);
  }

  async function deleteConversation(id: string) {
    await apiJson(`/api/conversations/${id}`, { method: "DELETE" });
    setConversations((items) => items.filter((item) => item.id !== id));

    if (activeId === id) {
      setActiveId(null);
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
    <main className="flex h-screen bg-neutral-950 text-neutral-50">
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConversation}
        onCreate={createConversation}
        onDelete={deleteConversation}
      />
      <section className="flex min-w-0 flex-1 flex-col">
        {error ? <div className="border-b border-red-900 bg-red-950 px-4 py-2 text-sm text-red-100">{error}</div> : null}
        <MessageList messages={messages} loading={loading} />
        <Composer disabled={loading} onSend={sendMessage} />
      </section>
    </main>
  );
}
