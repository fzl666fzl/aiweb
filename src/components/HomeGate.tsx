"use client";

import { type ReactNode, useEffect, useState } from "react";
import { apiJson } from "@/lib/client-api";
import { AuthForm } from "./AuthForm";

type AuthStatus = "checking" | "authenticated" | "guest";

export function HomeGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(async () => {
      try {
        await apiJson("/api/conversations?appId=mamanshuo");
        if (!cancelled) {
          setStatus("authenticated");
        }
      } catch {
        if (!cancelled) {
          setStatus("guest");
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "authenticated") {
    return <>{children}</>;
  }

  return (
    <main className="min-h-dvh bg-[#f7f2e8] px-5 py-6 text-stone-900 md:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md items-center justify-center">
        {status === "checking" ? (
          <div
            className="w-full rounded-lg border border-stone-200 bg-[#fffdf8]/95 p-6 text-sm text-stone-600 shadow-sm"
            role="status"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">
              fzl
            </div>
            正在检查登录状态...
          </div>
        ) : (
          <AuthForm
            brandIcon="fzl"
            className="w-full rounded-lg border border-stone-200 bg-[#fffdf8]/95 p-6 shadow-sm"
            description="先用 QQ 邮箱登录或注册账号，再进入 fzl AI 聊天小站。注册仅支持 QQ 邮箱。"
            title="登录或注册"
            onAuthenticated={() => setStatus("authenticated")}
          />
        )}
      </div>
    </main>
  );
}
