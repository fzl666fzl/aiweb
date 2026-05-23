"use client";

import Link from "next/link";
import { AccountMenu } from "./AccountMenu";

const apps = [
  {
    title: "慢慢说",
    status: "已开放",
    description: "适合情绪低落、压力大、不知道和谁说时使用。",
    href: "/apps/mamanshuo",
    action: "进入慢慢说",
    examples: [
      { label: "我有点累", prompt: "我有点累，但又说不清楚哪里累。请陪我慢慢梳理一下。" },
      { label: "最近压力很大", prompt: "我最近压力很大，有点喘不过气。请陪我把这些压力一件件理出来。" },
      { label: "我不知道怎么说", prompt: "我现在不知道怎么说，只觉得心里有点乱。请用几个问题慢慢引导我。" },
    ],
  },
  {
    title: "和名人对话",
    status: "已开放",
    description: "适合产品、学习、职业、决策问题，用一个顾问视角帮你拆解。",
    href: "/apps/celebrities",
    action: "进入名人对话",
    personaId: "zhangxuefeng",
    examples: [
      { label: "我该怎么选专业？", prompt: "我该怎么选专业？请从就业、现实约束和长期发展帮我拆解。" },
      { label: "这个产品方向靠谱吗？", prompt: "这个产品方向靠谱吗？请先帮我判断用户、场景和验证路径。" },
      { label: "这个决定风险在哪？", prompt: "我正在做一个重要决定，请帮我找出最容易忽略的风险。" },
    ],
  },
  {
    title: "写作润色",
    status: "即将开放",
    description: "帮你把表达变自然、变清楚，适合文案、作业和日常表达。",
  },
];

type AppCard = (typeof apps)[number];

const instructions = [
  {
    title: "这个站是什么",
    description: "fzl AI 聊天小站是给少量同学和朋友使用的 AI 对话入口，目前包含陪伴聊天和顾问式分析。",
  },
  {
    title: "怎么开始",
    description: "从聊天入口选择一个场景，或者点卡片里的示例问题，进入后可以先修改再发送。",
  },
  {
    title: "历史和账号",
    description: "聊天历史会保存在你的账号下。刷新页面或换设备登录后，可以继续查看自己的历史会话。",
  },
  {
    title: "使用边界",
    description: "慢慢说不是心理咨询或治疗服务。如果你正处于危险中，请立即联系身边可信任的人，或拨打 110 / 120。",
  },
];

function hasExamples(app: AppCard): app is AppCard & { examples: Array<{ label: string; prompt: string }> } {
  return "examples" in app && Array.isArray(app.examples);
}

function promptHref(app: AppCard, prompt: string) {
  if (!app.href) {
    return "#";
  }

  const params = new URLSearchParams();
  if ("personaId" in app && app.personaId) {
    params.set("personaId", app.personaId);
  }
  params.set("prompt", prompt);

  return `${app.href}?${params.toString()}`;
}

export function HomeContent() {
  return (
    <main className="min-h-dvh bg-[#f7f2e8] px-5 py-6 text-stone-900 md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white shadow-sm">
              fzl
            </div>
            <div>
              <h1 className="text-lg font-semibold text-stone-950">fzl AI 聊天小站</h1>
              <p className="text-sm text-stone-500">给同学和朋友用的 AI 对话入口</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex gap-2 text-sm text-stone-500" aria-label="聊天站导航">
              <a
                className="rounded-full bg-white/70 px-3 py-1.5 transition hover:bg-white hover:text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                href="#apps"
              >
                入口
              </a>
              <a
                className="rounded-full bg-white/70 px-3 py-1.5 transition hover:bg-white hover:text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                href="#instructions"
              >
                说明
              </a>
            </nav>
            <AccountMenu />
          </div>
        </header>

        <section className="max-w-3xl">
          <p className="mb-4 text-sm font-medium text-emerald-700">AI 对话入口</p>
          <h2 className="text-3xl font-semibold leading-tight text-stone-950 md:text-5xl">
            想聊什么，先选一个入口。
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-stone-600">
            不知道怎么开始时，可以直接点下面的示例问题。进入聊天页后会先放进输入框，你可以改完再发送。
          </p>
        </section>

        <section aria-labelledby="apps-title" id="apps">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700">新手可以这样开始</p>
              <h2 id="apps-title" className="mt-1 text-xl font-semibold text-stone-950">
                聊天入口
              </h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {apps.map((app) => (
              <article
                className="flex min-h-56 flex-col rounded-lg border border-stone-200 bg-[#fffdf8]/95 p-5 shadow-sm"
                key={app.title}
              >
                <span
                  className={`w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${
                    app.href
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  {app.status}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-stone-950">{app.title}</h3>
                <p className="mt-2 text-sm leading-7 text-stone-600">{app.description}</p>
                {hasExamples(app) ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {app.examples.map((example) => (
                      <Link
                        key={example.label}
                        className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        href={promptHref(app, example.prompt)}
                      >
                        {example.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
                {app.href ? (
                  <Link
                    className="mt-5 inline-flex w-fit rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    href={app.href}
                  >
                    {app.action}
                  </Link>
                ) : (
                  <span className="mt-5 text-sm font-medium text-stone-400">还在路上</span>
                )}
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="instructions-title" id="instructions">
          <div className="border-t border-stone-200 pt-6">
            <p className="mb-2 text-sm font-medium text-emerald-700">使用前看一下</p>
            <h2 id="instructions-title" className="text-xl font-semibold text-stone-950">
              使用说明
            </h2>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {instructions.map((item) => (
              <article className="rounded-lg border border-stone-200 bg-[#fffdf8]/90 p-5 shadow-sm" key={item.title}>
                <h3 className="text-sm font-semibold text-stone-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-stone-600">{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
