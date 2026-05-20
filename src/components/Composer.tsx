"use client";

import { FormEvent, useState } from "react";

export function Composer({ disabled, onSend }: { disabled: boolean; onSend: (message: string) => Promise<void> }) {
  const [value, setValue] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = value.trim();

    if (!message) {
      return;
    }

    setValue("");
    await onSend(message);
  }

  return (
    <form onSubmit={submit} className="shrink-0 border-t border-white/70 bg-white/75 px-4 py-4 backdrop-blur md:px-8">
      <div className="mx-auto flex max-w-4xl items-end gap-3 rounded-[24px] border border-white/80 bg-white p-2 shadow-[0_18px_55px_rgba(37,99,235,0.12)]">
        <textarea
          className="min-h-12 flex-1 resize-none rounded-[18px] bg-transparent px-3 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="问我任何问题"
          maxLength={4000}
          disabled={disabled}
        />
        <button
          className="h-12 shrink-0 rounded-[18px] bg-blue-600 px-5 text-sm font-semibold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
        >
          发送
        </button>
      </div>
    </form>
  );
}
