import type { ConversationSummary } from "@/lib/types";

type Props = {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
};

export function ConversationList({ conversations, activeId, onSelect, onCreate, onDelete }: Props) {
  return (
    <aside className="flex h-56 shrink-0 flex-col border-b border-white/70 bg-white/75 backdrop-blur md:h-full md:w-80 md:border-b-0 md:border-r">
      <div className="shrink-0 p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-xs font-bold text-white shadow-lg shadow-blue-200">
            AI
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">AI 问答</p>
            <p className="text-xs text-slate-500">我的对话</p>
          </div>
        </div>
        <button
          type="button"
          className="h-11 w-full rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
          onClick={onCreate}
        >
          新建对话
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {conversations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-5 text-center text-sm text-slate-500">
            还没有对话
          </p>
        ) : null}
        {conversations.map((conversation) => (
          <div key={conversation.id} className="mb-1 flex items-center gap-1">
            <button
              type="button"
              className={`min-w-0 flex-1 rounded-2xl px-4 py-3 text-left text-sm transition ${
                activeId === conversation.id
                  ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100"
                  : "text-slate-600 hover:bg-white/75 hover:text-slate-950"
              }`}
              onClick={() => onSelect(conversation.id)}
            >
              <span className="block truncate">{conversation.title}</span>
            </button>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg leading-none text-slate-400 transition hover:bg-red-50 hover:text-red-500"
              aria-label={`删除 ${conversation.title}`}
              title="删除"
              onClick={() => onDelete(conversation.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
