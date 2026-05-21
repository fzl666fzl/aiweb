"use client";

import { FormEvent, KeyboardEvent, useRef } from "react";

const SCENARIO_TEMPLATES = [
  { label: "有点累", prompt: "我有点累，但又说不清楚哪里累。请陪我慢慢梳理一下。" },
  { label: "焦虑", prompt: "我最近有些焦虑，脑子里一直停不下来。请陪我把这些想法慢慢理清楚。" },
  { label: "关系", prompt: "我想聊聊一段关系里的困扰，请先听我说，再帮我整理感受。" },
  { label: "复盘", prompt: "陪我复盘一下今天发生的事，帮我看见哪些地方已经尽力了。" },
  { label: "日记", prompt: "请帮我把现在的感受整理成一段温柔、真实的日记。" },
  { label: "说不清", prompt: "我现在不知道怎么说，只觉得心里有点乱。请用几个问题慢慢引导我。" },
];

type ComposerProps = {
  disabled: boolean;
  onSend: (message: string) => Promise<void>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showScenarioTemplates?: boolean;
};

export function Composer({
  disabled,
  onSend,
  value,
  onChange,
  placeholder = "写下此刻想说的话，或选一个入口开始...",
  showScenarioTemplates = true,
}: ComposerProps) {
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
    <form onSubmit={submit} className="shrink-0 border-t border-stone-200 bg-[#fffdf8]/90 px-4 py-4 backdrop-blur md:px-8">
      <div className="mx-auto max-w-5xl">
        {showScenarioTemplates ? (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1" aria-label="陪伴入口">
            {SCENARIO_TEMPLATES.map((template) => (
              <button
                key={template.label}
                type="button"
                className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                onClick={() => onChange(template.prompt)}
                disabled={disabled}
              >
                {template.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-3 rounded-lg border border-stone-200 bg-white p-2 shadow-sm">
          <textarea
            aria-label="消息输入"
            className="min-h-12 flex-1 resize-none rounded-lg bg-transparent px-3 py-3 text-sm leading-6 text-stone-900 outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
            placeholder={placeholder}
            maxLength={4000}
            disabled={disabled}
          />
          <button
            className="h-12 shrink-0 rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
          >
            发送
          </button>
        </div>
      </div>
    </form>
  );
}
