"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { apiJson } from "@/lib/client-api";
import { MEMBERSHIP_TIERS, type MembershipSummary, type MembershipTierId } from "@/lib/membership";
import { useSession } from "./SessionProvider";

type MembershipPlansProps = {
  currentTierId?: MembershipTierId;
  usage?: MembershipSummary | null;
};

const paidTiers = MEMBERSHIP_TIERS.filter((tier) => tier.id !== "free");

function getPurchaseUrl(tierId: MembershipTierId) {
  if (tierId === "plus") {
    return process.env.NEXT_PUBLIC_LDXP_PLUS_URL;
  }

  if (tierId === "pro") {
    return process.env.NEXT_PUBLIC_LDXP_PRO_URL;
  }

  return undefined;
}

export function MembershipPlans({ currentTierId, usage }: MembershipPlansProps) {
  const { refresh } = useSession();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const activeTierId = currentTierId ?? usage?.tierId ?? "free";
  const activeTier = MEMBERSHIP_TIERS.find((tier) => tier.id === activeTierId) ?? MEMBERSHIP_TIERS[0];
  const used = usage?.monthlyMessagesUsed ?? 0;
  const limit = usage?.monthlyMessageLimit ?? activeTier.monthlyMessageLimit;
  const remaining = usage?.monthlyMessagesRemaining ?? Math.max(limit - used, 0);
  const progress = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));

  useEffect(() => {
    if (!open) {
      return;
    }

    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  async function submitRedeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      setError("请输入兑换码。");
      setSuccess("");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      await apiJson("/api/membership/redeem", {
        body: JSON.stringify({ code: trimmedCode }),
        method: "POST",
      });
      setCode("");
      setSuccess("兑换成功，会员额度已刷新。");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "兑换失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="membership-title" id="membership">
      <div className="rounded-lg border border-stone-200 bg-[#fffdf8]/95 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">不同用量，分开管理</p>
            <h2 id="membership-title" className="mt-1 text-xl font-semibold text-stone-950">
              会员额度
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              当前为 {activeTier.name}，本月已用 {used} / {limit}，剩余 {remaining} 次。
              {usage?.expiresAt ? ` 有效期至 ${new Date(usage.expiresAt).toLocaleDateString("zh-CN")}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            onClick={() => {
              setOpen(true);
              setError("");
              setSuccess("");
            }}
          >
            充值 / 升级
          </button>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100">
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">
          <span>本月已用 {used} / {limit}</span>
          <span>剩余 {remaining} 次</span>
          {usage?.periodLabel ? <span>{usage.periodLabel} 额度周期</span> : null}
        </div>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-stone-950/35 px-4 pb-4 pt-10 sm:items-center sm:justify-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <section
            aria-label="充值或升级会员"
            aria-modal="true"
            className="max-h-[86dvh] w-full max-w-3xl overflow-hidden rounded-lg border border-stone-200 bg-[#fffdf8] shadow-xl"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-4 py-4">
              <div>
                <h3 className="text-lg font-semibold text-stone-950">充值或升级会员</h3>
                <p className="mt-1 text-sm leading-6 text-stone-500">先去链动小铺购买卡密，付款后回到这里兑换。</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-950 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                aria-label="关闭充值窗口"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="grid max-h-[70dvh] gap-4 overflow-y-auto p-4 md:grid-cols-[1fr_1fr]">
              <div className="space-y-3">
                {paidTiers.map((tier) => {
                  const purchaseUrl = getPurchaseUrl(tier.id);

                  return (
                    <article className="rounded-lg border border-stone-200 bg-white p-4" key={tier.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-lg font-semibold text-stone-950">{tier.name}</h4>
                          <p className="mt-1 text-sm text-stone-500">{tier.description}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {tier.priceLabel}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-stone-600">每月 {tier.monthlyMessageLimit} 次 AI 对话</p>
                      {purchaseUrl ? (
                        <a
                          className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300"
                          href={purchaseUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          去链动小铺购买
                        </a>
                      ) : (
                        <span className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border border-stone-200 bg-stone-50 px-4 text-sm font-semibold text-stone-500">
                          暂未配置购买链接
                        </span>
                      )}
                    </article>
                  );
                })}
              </div>
              <form className="rounded-lg border border-stone-200 bg-white p-4" onSubmit={submitRedeem}>
                <h4 className="text-base font-semibold text-stone-950">兑换卡密</h4>
                <p className="mt-2 text-sm leading-6 text-stone-500">链动小铺自动发货后，把兑换码粘贴到这里。</p>
                <label className="mt-4 block" htmlFor="membership-code">
                  <span className="mb-2 block text-sm font-medium text-stone-700">兑换码</span>
                  <input
                    className="h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    id="membership-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="AIWEB-PLUS-XXXXXX"
                    disabled={busy}
                  />
                </label>
                {error ? (
                  <p className="mt-3 text-sm text-rose-600" role="alert">
                    {error}
                  </p>
                ) : null}
                {success ? (
                  <p className="mt-3 text-sm text-emerald-700" role="status">
                    {success}
                  </p>
                ) : null}
                <button
                  className="mt-4 h-10 w-full rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={busy}
                >
                  {busy ? "兑换中..." : "兑换会员"}
                </button>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
