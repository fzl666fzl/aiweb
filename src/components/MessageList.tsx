import type { ChatMessage } from "@/lib/types";

export function MessageList({ messages, loading }: { messages: ChatMessage[]; loading: boolean }) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      {messages.length === 0 ? (
        <div className="mx-auto flex h-full max-w-2xl items-center justify-center text-center text-neutral-500">
          输入一个问题开始新的对话。
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
              <div
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-6 ${
                  message.role === "user" ? "bg-emerald-300 text-neutral-950" : "bg-neutral-900 text-neutral-100"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {loading ? <p className="text-sm text-neutral-500">正在回答...</p> : null}
        </div>
      )}
    </div>
  );
}
