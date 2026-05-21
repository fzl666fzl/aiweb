"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/client-api";
import { AuthForm } from "./AuthForm";

export function HomeAuthPanel() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(async () => {
      try {
        await apiJson("/api/conversations?appId=mamanshuo");
        if (!cancelled) {
          setAuthenticated(true);
        }
      } catch {
        if (!cancelled) {
          setAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside
      aria-label="账号入口"
      className="rounded-lg border border-stone-200 bg-[#fffdf8]/90 p-5 text-sm leading-7 text-stone-600 shadow-sm"
    >
      {checking ? <p className="text-sm text-stone-500">正在检查登录状态...</p> : null}
      {!checking && authenticated ? (
        <div>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">
            fzl
          </div>
          <p className="text-lg font-semibold text-stone-950">已登录</p>
          <p className="mt-2">可以直接进入慢慢说或名人对话，历史记录会跟着你的账号走。</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              className="inline-flex rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              href="/apps/mamanshuo"
            >
              进入慢慢说
            </Link>
            <Link
              className="inline-flex rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              href="/apps/celebrities"
            >
              名人对话
            </Link>
          </div>
        </div>
      ) : null}
      {!checking && !authenticated ? (
        <AuthForm
          brandIcon="fzl"
          className="w-full"
          description="先在这里登录或注册账号，再进入任意功能。注册仅支持 QQ 邮箱。"
          title="账号入口"
          onAuthenticated={() => setAuthenticated(true)}
        />
      ) : null}
    </aside>
  );
}
