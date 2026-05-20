import type { ChatMessage } from "@/lib/types";

export function MessageList({ messages, loading }: { messages: ChatMessage[]; loading: boolean }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
      {messages.length === 0 ? (
        <div className="mx-auto flex h-full max-w-3xl items-center justify-center text-center">
          <div>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[24px] bg-blue-600 text-sm font-bold text-white shadow-xl shadow-blue-200">
              AI
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">今天想聊点什么？</h2>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex max-w-4xl flex-col gap-5">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[86%] whitespace-pre-wrap rounded-[22px] px-4 py-3 text-sm leading-7 shadow-sm md:max-w-[74%] ${
                  message.role === "user"
                    ? "rounded-br-md bg-blue-600 text-white shadow-blue-100"
                    : "rounded-bl-md border border-white/80 bg-white/90 text-slate-800"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {loading ? (
            <div className="flex justify-start">
              <div className="rounded-[22px] rounded-bl-md border border-white/80 bg-white/90 px-4 py-3 text-sm text-slate-500 shadow-sm">
                <span className="inline-flex items-center gap-1">
                  正在思考
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400 [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
