"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";

const PROMPT_CARDS = [
  {
    title: "写一篇文案",
    description: "产品介绍、朋友圈、小红书开头",
    prompt: "帮我写一篇小红书风格的产品介绍，语气自然一点。",
  },
  {
    title: "总结内容",
    description: "把长内容提炼成重点",
    prompt: "把下面这段话总结成 3 个重点：",
  },
  {
    title: "改写润色",
    description: "更自然、更专业、更清楚",
    prompt: "帮我把下面这段话改得更自然、更专业：",
  },
  {
    title: "学习解释",
    description: "讲清概念并举例",
    prompt: "用简单的话解释这个概念，并举一个例子：",
  },
  {
    title: "代码助手",
    description: "分析报错、改代码、写思路",
    prompt: "帮我分析这段代码的问题，并给出修改建议：",
  },
  {
    title: "头脑风暴",
    description: "快速生成多个方向",
    prompt: "围绕这个主题给我 10 个有创意的想法：",
  },
];

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
          <blockquote className="my-4 border-l-4 border-blue-200 bg-blue-50/60 px-4 py-2 text-slate-700">
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
            className="font-medium text-blue-700 underline decoration-blue-200 underline-offset-4 hover:text-blue-800"
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
    <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-6 md:px-8">
      {messages.length === 0 ? (
        <div className="mx-auto flex min-h-full max-w-4xl items-center justify-center">
          <section className="w-full" aria-labelledby="empty-workbench-title">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-sm font-bold text-white shadow-sm">
                AI
              </div>
              <h2 id="empty-workbench-title" className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                今天想做点什么？
              </h2>
              <p className="mt-3 text-sm text-slate-500">选择一个场景，或者直接输入你的问题。</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PROMPT_CARDS.map((card) => (
                <button
                  key={card.title}
                  type="button"
                  className="rounded-2xl border border-slate-200 bg-white/90 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                  onClick={() => onPromptSelect(card.prompt)}
                >
                  <span className="block text-sm font-semibold text-slate-950">{card.title}</span>
                  <span className="mt-2 block text-xs leading-5 text-slate-500">{card.description}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div
          aria-live="polite"
          aria-relevant="additions text"
          className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-5 border-x border-slate-200/70 bg-white/55 px-4 py-6 md:px-6"
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
                  className={`break-words rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${
                    message.role === "user"
                      ? "whitespace-pre-wrap rounded-br-md bg-blue-600 text-white"
                      : "rounded-bl-md border border-slate-200 bg-white text-[15px] text-slate-800 shadow-[0_10px_35px_rgba(15,23,42,0.04)]"
                  }`}
                >
                  {message.role === "assistant" ? <AssistantMarkdown content={message.content} /> : message.content}
                </div>
                {message.role === "assistant" ? (
                  <div className="mt-2 flex justify-start">
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                aria-label="AI 正在思考"
                className="rounded-2xl rounded-bl-md border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-500 shadow-sm"
                role="status"
              >
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
