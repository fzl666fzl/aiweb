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
    <form onSubmit={submit} className="border-t border-neutral-800 bg-neutral-950 p-4">
      <div className="mx-auto flex max-w-3xl gap-2">
        <textarea
          className="min-h-14 flex-1 resize-none rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 outline-none focus:border-emerald-300"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="输入你的问题"
          maxLength={4000}
          disabled={disabled}
        />
        <button className="h-14 rounded-md bg-emerald-300 px-5 text-sm font-medium text-neutral-950 disabled:opacity-60" disabled={disabled}>
          发送
        </button>
      </div>
    </form>
  );
}
