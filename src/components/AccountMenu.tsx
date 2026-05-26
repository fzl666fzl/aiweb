"use client";

import { useState } from "react";
import { useSession } from "./SessionProvider";

type AccountMenuProps = {
  compact?: boolean;
};

export function AccountMenu({ compact = false }: AccountMenuProps) {
  const { logout, user } = useSession();
  const membership = user?.membership;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setBusy(true);
    setError("");

    try {
      await logout();
    } catch {
      setError("退出失败，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="账号设置"
      className={`relative flex items-center gap-2 rounded-lg border border-stone-200 bg-white/80 text-stone-700 ${
        compact ? "h-9 px-2 text-xs" : "flex-wrap px-3 py-2 text-sm"
      }`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
      <span className="shrink-0 font-medium text-emerald-700">已登录</span>
      {membership ? (
        <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
          {membership.name}
        </span>
      ) : null}
      <span className="max-w-40 truncate text-stone-500" title={user?.email}>
        {user?.email ?? "当前账号"}
      </span>
      {membership && !compact ? (
        <span className="shrink-0 text-xs text-stone-500">
          本月 {membership.monthlyMessagesUsed}/{membership.monthlyMessageLimit}
        </span>
      ) : null}
      <button
        type="button"
        className="rounded-md px-2 py-1 font-semibold text-stone-500 transition hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={busy}
        onClick={handleLogout}
      >
        {busy ? "退出中" : "退出登录"}
      </button>
      {error ? (
        <span
          className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow-sm"
          role="alert"
        >
          {error}
        </span>
      ) : null}
    </section>
  );
}
