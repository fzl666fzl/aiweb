"use client";

import { useMemo, useState } from "react";
import type { ConversationSummary } from "@/lib/types";

type Props = {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
};

export function ConversationList({ conversations, activeId, onSelect, onCreate, onDelete }: Props) {
  const [query, setQuery] = useState("");
  const filteredConversations = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return conversations;
    }
    return conversations.filter((conversation) => conversation.title.toLowerCase().includes(keyword));
  }, [conversations, query]);

  return (
    <aside className="flex h-64 shrink-0 flex-col border-b border-slate-200 bg-white/85 backdrop-blur md:h-full md:w-80 md:border-b-0 md:border-r">
      <div className="shrink-0 p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-xs font-bold text-white shadow-sm">
            AI
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">AI 问答</p>
            <p className="text-xs text-slate-500">我的对话工作台</p>
          </div>
        </div>
        <button
          type="button"
          className="h-11 w-full rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
          onClick={onCreate}
        >
          新建对话
        </button>
        <label className="mt-3 block">
          <span className="sr-only">搜索历史对话</span>
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索历史对话"
            type="search"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <p className="mb-2 px-2 text-xs font-medium text-slate-400">最近对话</p>
        {filteredConversations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-5 text-center text-sm text-slate-500">
            还没有对话
          </p>
        ) : null}
        {filteredConversations.map((conversation) => (
          <div key={conversation.id} className="mb-1 flex items-center gap-1">
            <button
              type="button"
              className={`min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                activeId === conversation.id
                  ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                  : "text-slate-600 hover:bg-white hover:text-slate-950"
              }`}
              onClick={() => onSelect(conversation.id)}
            >
              <span className="block truncate">{conversation.title}</span>
            </button>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
              aria-label={`删除 ${conversation.title}`}
              title="删除"
              onClick={() => onDelete(conversation.id)}
            >
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <path d="M9 4h6m-8 4h10m-9 0 .6 11h6.8L16 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
