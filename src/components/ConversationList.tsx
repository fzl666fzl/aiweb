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
    <aside className="flex h-full w-full flex-col border-r border-neutral-800 bg-neutral-950 md:w-72">
      <div className="border-b border-neutral-800 p-3">
        <button className="w-full rounded-md bg-emerald-300 px-3 py-2 text-sm font-medium text-neutral-950" onClick={onCreate}>
          新会话
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? <p className="px-2 py-3 text-sm text-neutral-500">暂无历史会话</p> : null}
        {conversations.map((conversation) => (
          <div key={conversation.id} className="mb-1 flex items-center gap-1">
            <button
              className={`min-w-0 flex-1 rounded-md px-3 py-2 text-left text-sm ${
                activeId === conversation.id ? "bg-neutral-800 text-neutral-50" : "text-neutral-300 hover:bg-neutral-900"
              }`}
              onClick={() => onSelect(conversation.id)}
            >
              <span className="block truncate">{conversation.title}</span>
            </button>
            <button
              className="rounded-md px-2 py-2 text-sm text-neutral-500 hover:bg-neutral-900 hover:text-red-300"
              aria-label={`删除 ${conversation.title}`}
              onClick={() => onDelete(conversation.id)}
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
