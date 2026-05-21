"use client";

import { type FormEvent, useState } from "react";
import { apiJson } from "@/lib/client-api";

type AuthMode = "login" | "register";

type AuthFormProps = {
  brandIcon: string;
  title: string;
  description?: string;
  className?: string;
  onAuthenticated: () => Promise<void> | void;
};

export function AuthForm({
  brandIcon,
  title,
  description = "用 QQ 邮箱登录或注册账号后进入。",
  className = "w-full max-w-sm rounded-lg border border-stone-200 bg-[#fffdf8] p-6 shadow-sm",
  onAuthenticated,
}: AuthFormProps) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = authEmail.trim().toLowerCase();
    const password = authPassword;

    if (!email) {
      setError("请输入 QQ 邮箱。");
      return;
    }

    if (authMode === "register" && !/^[^\s@]+@qq\.com$/i.test(email)) {
      setError("注册账号只能使用 QQ 邮箱。");
      return;
    }

    if (!password) {
      setError("请输入密码。");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await apiJson("/api/auth", { method: "POST", body: JSON.stringify({ mode: authMode, email, password }) });
      setAuthPassword("");
      await onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "账号验证失败，请重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={className} onSubmit={submitAccess}>
      <div className="mb-5">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">
          {brandIcon}
        </div>
        <h1 className="text-xl font-semibold text-stone-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
      </div>
      <div className="mb-4 grid grid-cols-2 rounded-lg border border-stone-200 bg-white p-1">
        {(["login", "register"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`h-9 rounded-md text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
              authMode === mode ? "bg-emerald-700 text-white" : "text-stone-600 hover:bg-emerald-50"
            }`}
            aria-pressed={authMode === mode}
            onClick={() => {
              setAuthMode(mode);
              setError("");
            }}
          >
            {mode === "login" ? "登录" : "注册"}
          </button>
        ))}
      </div>
      <label className="block" htmlFor="auth-email">
        <span className="mb-2 block text-sm font-medium text-stone-700">QQ 邮箱</span>
        <input
          className="h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
          id="auth-email"
          value={authEmail}
          onChange={(event) => setAuthEmail(event.target.value)}
          placeholder="123456@qq.com"
          type="email"
          autoComplete="email"
          disabled={loading}
        />
      </label>
      <label className="mt-3 block" htmlFor="auth-password">
        <span className="mb-2 block text-sm font-medium text-stone-700">密码</span>
        <input
          className="h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
          id="auth-password"
          value={authPassword}
          onChange={(event) => setAuthPassword(event.target.value)}
          placeholder="至少 8 位"
          type="password"
          autoComplete="current-password"
          disabled={loading}
        />
      </label>
      <p className="mt-3 text-xs leading-5 text-stone-500">
        {authMode === "register" ? "注册账号只能使用 @qq.com 邮箱。" : "还没有账号的话，请先切换到注册。"}
      </p>
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="mt-5 h-11 w-full rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading}
      >
        {loading ? "验证中..." : authMode === "register" ? "注册账号" : "登录"}
      </button>
    </form>
  );
}
