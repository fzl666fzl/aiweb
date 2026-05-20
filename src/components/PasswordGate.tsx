"use client";

import { FormEvent, useState } from "react";
import { apiJson } from "@/lib/client-api";

export function PasswordGate({ onAuthed }: { onAuthed: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await apiJson("/api/auth", { method: "POST", body: JSON.stringify({ code }) });
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "访问失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-neutral-50">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <h1 className="text-xl font-semibold">AI 问答</h1>
        <label className="block text-sm">
          访问密码
          <input
            className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-emerald-300"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            type="password"
            autoFocus
          />
        </label>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button
          className="w-full rounded-md bg-emerald-300 px-3 py-2 font-medium text-neutral-950 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "验证中" : "进入"}
        </button>
      </form>
    </main>
  );
}
