"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";

const PROMPT_CARDS = [
  {
    title: "我有点累",
    description: "先把疲惫说出来",
    prompt: "我有点累，但又说不清楚哪里累。请陪我慢慢梳理一下。",
  },
  {
    title: "最近压力很大",
    description: "把压力拆小一点",
    prompt: "我最近压力很大，有点喘不过气。请陪我把这些压力一件件理出来。",
  },
  {
    title: "我有些焦虑",
    description: "让脑子慢下来",
    prompt: "我最近有些焦虑，脑子里一直停不下来。请陪我把这些想法慢慢理清楚。",
  },
  {
    title: "想聊聊关系",
    description: "关系里的难受也可以说",
    prompt: "我想聊聊一段关系里的困扰，请先听我说，再帮我整理感受。",
  },
  {
    title: "陪我复盘今天",
    description: "看见已经尽力的地方",
    prompt: "陪我复盘一下今天发生的事，帮我看见哪些地方已经尽力了。",
  },
  {
    title: "我不知道怎么说",
    description: "从一句话开始也可以",
    prompt: "我现在不知道怎么说，只觉得心里有点乱。请用几个问题慢慢引导我。",
  },
];

const SAFETY_NOTE =
  "这里不能替代专业帮助。如果你正处于危险中，或可能伤害自己/他人，请立即联系身边可信任的人，或拨打 110 / 120。如果需要心理援助，也可以尝试拨打全国统一心理援助热线 12356。";

type MessageListProps = {
  messages: ChatMessage[];
  loading: boolean;
  onPromptSelect: (prompt: string) => void;
};

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-3 mt-6 text-xl font-semibold leading-8 text-slate-950 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-3 mt-6 text-lg font-semibold leading-7 text-slate-950 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-5 text-base font-semibold leading-7 text-slate-950 first:mt-0">{children}</h3>
        ),
        p: ({ children }) => <p className="my-3 leading-7 first:mt-0 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
        hr: () => <hr className="my-5 border-slate-200" />,
        blockquote: ({ children }) => (
          <blockquote className="my-4 border-l-4 border-emerald-200 bg-emerald-50/70 px-4 py-2 text-stone-700">
            {children}
          </blockquote>
        ),
        code: ({ children, className }) => (
          <code className={`${className ?? ""} rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-800`}>
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="my-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-100 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-slate-100">
            {children}
          </pre>
        ),
        a: ({ children, href }) => (
          <a
            className="font-medium text-emerald-700 underline decoration-emerald-200 underline-offset-4 hover:text-emerald-800"
            href={href}
            rel="noreferrer"
            target="_blank"
          >
            {children}
          </a>
        ),
        table: ({ children }) => <table className="my-4 w-full border-collapse text-left text-sm">{children}</table>,
        th: ({ children }) => <th className="border border-slate-200 bg-slate-50 px-3 py-2 font-semibold">{children}</th>,
        td: ({ children }) => <td className="border border-slate-200 px-3 py-2 align-top">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function MessageList({ messages, loading, onPromptSelect }: MessageListProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f2e8] px-4 py-6 md:px-8">
      {messages.length === 0 ? (
        <div className="mx-auto flex min-h-full max-w-4xl items-center justify-center">
          <section className="w-full" aria-labelledby="empty-workbench-title">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-700 text-base font-bold text-white shadow-sm">
                慢
              </div>
              <h2 id="empty-workbench-title" className="text-2xl font-semibold text-stone-950 md:text-3xl">
                今天想先说点什么？
              </h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                可以是一句话、一个情绪、一个困扰，或者只是“我有点累”。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PROMPT_CARDS.map((card) => (
                <button
                  key={card.title}
                  type="button"
                  className="rounded-lg border border-stone-200 bg-[#fffdf8]/95 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  onClick={() => onPromptSelect(card.prompt)}
                >
                  <span className="block text-sm font-semibold text-stone-950">{card.title}</span>
                  <span className="mt-2 block text-xs leading-5 text-stone-500">{card.description}</span>
                </button>
              ))}
            </div>
            <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs leading-6 text-stone-600">
              {SAFETY_NOTE}
            </p>
          </section>
        </div>
      ) : (
        <div
          aria-live="polite"
          aria-relevant="additions text"
          className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-5 border-x border-stone-200/70 bg-[#fffdf8]/65 px-4 py-6 md:px-6"
          role="log"
        >
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={
                  message.role === "user"
                    ? "max-w-[86%] text-right md:max-w-[68%]"
                    : "w-full max-w-[94%] text-left md:max-w-[86%] lg:max-w-[80%]"
                }
              >
                <div
                  className={`break-words rounded-lg px-4 py-3 text-sm leading-7 shadow-sm ${
                    message.role === "user"
                      ? "whitespace-pre-wrap rounded-br-sm bg-emerald-700 text-white"
                      : "rounded-bl-sm border border-stone-200 bg-white text-[15px] text-stone-800 shadow-[0_10px_35px_rgba(68,64,60,0.04)]"
                  }`}
                >
                  {message.role === "assistant" ? <AssistantMarkdown content={message.content} /> : message.content}
                </div>
                {message.role === "assistant" ? (
                  <div className="mt-2 flex justify-start">
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs font-medium text-stone-500 transition hover:bg-white hover:text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      onClick={() => void navigator.clipboard?.writeText(message.content)}
                    >
                      复制回答
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {loading ? (
            <div className="flex justify-start">
              <div
                aria-label="AI 正在认真读你说的话"
                className="rounded-lg rounded-bl-sm border border-stone-200 bg-white/95 px-4 py-3 text-sm text-stone-500 shadow-sm"
                role="status"
              >
                <span className="inline-flex items-center gap-1">
                  正在认真读你说的话
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
