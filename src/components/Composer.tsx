"use client";

import { FormEvent, KeyboardEvent, useRef } from "react";

const SCENARIO_TEMPLATES = [
  { label: "写作", prompt: "请帮我写一段自然、有吸引力的文案：" },
  { label: "总结", prompt: "请把下面的内容总结成 3 个重点：" },
  { label: "翻译", prompt: "请把下面这段内容翻译成英文，并保持语气自然：" },
  { label: "代码", prompt: "请帮我分析这段代码的问题，并给出修改建议：" },
  { label: "学习", prompt: "请用简单的话解释这个概念，并举一个例子：" },
  { label: "想法", prompt: "请围绕这个主题给我 10 个有创意的想法：" },
];

type ComposerProps = {
  disabled: boolean;
  onSend: (message: string) => Promise<void>;
  value: string;
  onChange: (value: string) => void;
};

export function Composer({ disabled, onSend, value, onChange }: ComposerProps) {
  const composingRef = useRef(false);

  async function sendCurrentMessage() {
    if (disabled) {
      return;
    }

    const message = value.trim();

    if (!message) {
      return;
    }

    onChange("");
    await onSend(message);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await sendCurrentMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || composingRef.current || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    void sendCurrentMessage();
  }

  return (
    <form onSubmit={submit} className="shrink-0 border-t border-slate-200 bg-white/85 px-4 py-4 backdrop-blur md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1" aria-label="常用场景">
          {SCENARIO_TEMPLATES.map((template) => (
            <button
              key={template.label}
              type="button"
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              onClick={() => onChange(template.prompt)}
              disabled={disabled}
            >
              {template.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <textarea
            aria-label="消息输入"
            className="min-h-12 flex-1 resize-none rounded-xl bg-transparent px-3 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
            placeholder="输入问题，或选择一个场景开始..."
            maxLength={4000}
            disabled={disabled}
          />
          <button
            className="h-12 shrink-0 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
          >
            发送
          </button>
        </div>
      </div>
    </form>
  );
}
