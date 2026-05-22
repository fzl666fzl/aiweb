import Link from "next/link";
import { HomeGate } from "@/components/HomeGate";

const apps = [
  {
    title: "慢慢说",
    status: "已开放",
    description: "给同学们的情绪陪伴小站。累的时候，可以先在这里慢慢说。",
    href: "/apps/mamanshuo",
    action: "进入慢慢说",
  },
  {
    title: "和名人对话",
    status: "已开放",
    description: "选择一个名人视角，用顾问模式拆解产品、学习、专业和决策问题。",
    href: "/apps/celebrities",
    action: "进入名人对话",
  },
  {
    title: "写作润色",
    status: "即将开放",
    description: "帮你把表达变自然、变清楚，适合文案、作业和日常表达。",
  },
];

const instructions = [
  {
    title: "这个站是什么",
    description: "fzl AI 聊天小站是给少量同学和朋友使用的 AI 对话入口，目前包含陪伴聊天和顾问式分析。",
  },
  {
    title: "怎么开始",
    description: "先用 QQ 邮箱登录或注册账号，再从聊天入口进入慢慢说或和名人对话。",
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

export default function Home() {
  return (
    <HomeGate>
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
          </header>

          <section className="max-w-3xl">
            <p className="mb-4 text-sm font-medium text-emerald-700">AI 对话入口</p>
            <h2 className="text-3xl font-semibold leading-tight text-stone-950 md:text-5xl">
              把几个 AI 对话入口，放在这里。
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-stone-600">
              先从“慢慢说”开始。以后这里会继续放学习整理、写作润色和更多给同学使用的对话入口。
            </p>
          </section>

          <section aria-labelledby="apps-title" id="apps">
            <h2 id="apps-title" className="mb-4 text-xl font-semibold text-stone-950">
              聊天入口
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {apps.map((app) => (
                <article
                  className="flex min-h-48 flex-col rounded-lg border border-stone-200 bg-[#fffdf8]/95 p-5 shadow-sm"
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
                  <p className="mt-2 flex-1 text-sm leading-7 text-stone-600">{app.description}</p>
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
    </HomeGate>
  );
}
