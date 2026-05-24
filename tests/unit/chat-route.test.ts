import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/route";
import { streamChatCompletion } from "@/lib/ai";

const messageInsertCalls: unknown[] = [];
const conversationInsertCalls: unknown[] = [];
const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
const messageHistoryLimitCalls: number[] = [];
const studyMaterialSelectCalls: Array<{ select: string; filters: Array<[string, unknown]> }> = [];
const studyMaterialUpdateCalls: Array<{ values: unknown; filters: Array<[string, unknown]> }> = [];
let existingConversation: { id: string; app_id: string; persona_id: string } | null = null;
let quotaAllowed = true;
let studyMaterialLookup: { id: string; conversation_id: string | null } | null = null;
let studyMaterialsForConversation: Array<{ file_name: string; extracted_text: string }> = [];
let messageHistoryRows: Array<{ role: "user" | "assistant"; content: string }> = [];

vi.mock("@/lib/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ accessKeyId: "access-1", visitorId: "visitor-1" }),
}));

vi.mock("@/lib/env", () => ({
    getEnv: vi.fn((name: string) => {
    const values: Record<string, string> = {
      AI_BASE_URL: "https://example.test/v1",
      AI_API_KEY: "test-key",
      AI_MODEL: "test-model",
    };
    return values[name] ?? "test";
  }),
}));

vi.mock("@/lib/ai", () => ({
  streamChatCompletion: vi.fn(async function* () {
    yield "测试";
    yield "回答";
  }),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseAdmin: vi.fn(() => ({
    rpc: vi.fn((name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({
        data: [{ allowed: quotaAllowed, reason: quotaAllowed ? "ok" : "access_key_daily_limit" }],
        error: null,
      });
    }),
    from(table: string) {
      if (table === "access_keys") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { daily_limit: 100 },
                  error: null,
                }),
              })),
            })),
          })),
        };
      }

      if (table === "conversations") {
        return {
          insert: vi.fn((row: unknown) => {
            conversationInsertCalls.push(row);
            const inserted = row as { app_id?: string; persona_id?: string };
            return {
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "conversation-1",
                    app_id: inserted.app_id ?? "mamanshuo",
                    persona_id: inserted.persona_id ?? "maman",
                  },
                  error: null,
                }),
              })),
            };
          }),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: existingConversation, error: null }),
                  })),
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }

      if (table === "messages") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn((count: number) => {
                  messageHistoryLimitCalls.push(count);
                  return Promise.resolve({ data: messageHistoryRows.slice(0, count) });
                }),
              })),
            })),
          })),
          insert: vi.fn((rows: unknown) => {
            messageInsertCalls.push(rows);
            return Promise.resolve({ error: null });
          }),
        };
      }

      if (table === "study_materials") {
        return {
          select: vi.fn((select: string) => {
            const filters: Array<[string, unknown]> = [];
            const builder = {
              eq: vi.fn((column: string, value: unknown) => {
                filters.push([column, value]);
                return builder;
              }),
              single: vi.fn(() => {
                studyMaterialSelectCalls.push({ select, filters: [...filters] });
                return Promise.resolve({ data: studyMaterialLookup, error: null });
              }),
              order: vi.fn(() => {
                studyMaterialSelectCalls.push({ select, filters: [...filters] });
                return Promise.resolve({ data: studyMaterialsForConversation, error: null });
              }),
            };
            return builder;
          }),
          update: vi.fn((values: unknown) => {
            const filters: Array<[string, unknown]> = [];
            const builder = {
              eq: vi.fn((column: string, value: unknown) => {
                filters.push([column, value]);
                studyMaterialUpdateCalls.push({ values, filters: [...filters] });
                return Promise.resolve({ error: null });
              }),
            };
            return builder;
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  })),
}));

describe("chat route", () => {
  beforeEach(() => {
    messageInsertCalls.length = 0;
    conversationInsertCalls.length = 0;
    rpcCalls.length = 0;
    messageHistoryLimitCalls.length = 0;
    studyMaterialSelectCalls.length = 0;
    studyMaterialUpdateCalls.length = 0;
    existingConversation = null;
    quotaAllowed = true;
    studyMaterialLookup = null;
    studyMaterialsForConversation = [];
    messageHistoryRows = [];
    vi.mocked(streamChatCompletion).mockClear();
  });

  it("checks daily usage before streaming messages", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: "你好" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const text = await response.text();
    expect(text).toContain(
      'event: conversation\ndata: {"conversationId":"conversation-1","appId":"mamanshuo","personaId":"maman"}',
    );
    expect(text).toContain('event: delta\ndata: {"content":"测试"}');
    expect(text).toContain('event: delta\ndata: {"content":"回答"}');
    expect(text).toContain("event: done");
    expect(streamChatCompletion).toHaveBeenCalled();
    expect(rpcCalls[0]).toMatchObject({
      name: "increment_usage_if_allowed",
      args: {
        p_access_key_id: "access-1",
        p_visitor_id: "visitor-1",
        p_access_limit: 100,
        p_visitor_limit: 100,
      },
    });
    expect(conversationInsertCalls[0]).toMatchObject({
      access_key_id: "access-1",
      visitor_id: "visitor-1",
      app_id: "mamanshuo",
      persona_id: "maman",
    });
    expect(messageInsertCalls[0]).toMatchObject([
      { conversation_id: "conversation-1", role: "user", content: "你好" },
      { conversation_id: "conversation-1", role: "assistant", content: "测试回答" },
    ]);
  });

  it("rejects chat requests when the daily limit is reached", async () => {
    quotaAllowed = false;

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: "你好" }),
      }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "今天的提问次数已经用完了，请明天再来。",
    });
    expect(streamChatCompletion).not.toHaveBeenCalled();
    expect(conversationInsertCalls).toHaveLength(0);
    expect(messageInsertCalls).toHaveLength(0);
  });

  it("prepends the 慢慢说 system persona without saving it as a message", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: "我最近很累" }),
      }),
    );

    expect(response.status).toBe(200);
    await response.text();

    const [messages] = vi.mocked(streamChatCompletion).mock.calls[0];
    expect(messages[0]).toMatchObject({ role: "system" });
    expect(messages[0].content).toContain("慢慢说");
    expect(messages[0].content).toContain("你不是医生");
    expect(messages[0].content).toContain("不要急着给建议");
    expect(messages[0].content).toContain("像同学坐在旁边");
    expect(messages[0].content).toContain("不要固定套用流程");
    expect(messages[0].content).toContain("不用硬凑字数");
    expect(messages[0].content).toContain("只有在用户明确想分析");
    expect(messages[0].content).toContain("轻轻的问题");
    expect(messages[0].content).not.toContain("450 个汉字");
    expect(messages.at(-1)).toEqual({ role: "user", content: "我最近很累" });
    expect(JSON.stringify(messageInsertCalls[0])).not.toContain("\"role\":\"system\"");
  });

  it("uses the selected celebrity persona for new celebrity conversations", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ appId: "celebrities", personaId: "zhang-yiming", message: "怎么做产品" }),
      }),
    );

    expect(response.status).toBe(200);
    await response.text();

    expect(conversationInsertCalls[0]).toMatchObject({
      app_id: "celebrities",
      persona_id: "zhang-yiming",
    });
    const [messages] = vi.mocked(streamChatCompletion).mock.calls[0];
    expect(messages[0].content).toContain("张一鸣");
    expect(messages[0].content).toContain("顾问模式");
    expect(messages[0].content).not.toContain("你是张一鸣");
  });

  it("uses the stored persona for existing conversations instead of the request persona", async () => {
    existingConversation = { id: "conversation-2", app_id: "celebrities", persona_id: "munger" };

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          appId: "celebrities",
          conversationId: "conversation-2",
          personaId: "zhang-yiming",
          message: "这家公司能买吗",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await response.text();

    const [messages] = vi.mocked(streamChatCompletion).mock.calls[0];
    expect(messages[0].content).toContain("芒格");
    expect(messages[0].content).not.toContain("张一鸣");
  });

  it("rejects a celebrity persona from the wrong app", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ appId: "mamanshuo", personaId: "zhang-yiming", message: "你好" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "未知的人物。" });
    expect(streamChatCompletion).not.toHaveBeenCalled();
  });

  it("injects owned study material text into study chat context", async () => {
    studyMaterialLookup = { id: "material-1", conversation_id: null };
    studyMaterialsForConversation = [
      {
        file_name: "lesson.pdf",
        extracted_text: "第一章 管理学基础。计划、组织、领导、控制是考试重点。",
      },
    ];

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          appId: "study",
          personaId: "study-helper",
          studyMaterialId: "material-1",
          message: "请帮我总结这份课件",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await response.text();

    expect(conversationInsertCalls[0]).toMatchObject({
      app_id: "study",
      persona_id: "study-helper",
    });
    expect(studyMaterialSelectCalls[0]).toMatchObject({
      select: "id, conversation_id",
      filters: [
        ["id", "material-1"],
        ["access_key_id", "access-1"],
        ["visitor_id", "visitor-1"],
      ],
    });
    expect(studyMaterialUpdateCalls[0]).toMatchObject({
      values: { conversation_id: "conversation-1" },
      filters: [["id", "material-1"]],
    });
    const [messages] = vi.mocked(streamChatCompletion).mock.calls[0];
    expect(messages[0].content).toContain("复习助手");
    expect(messages[1]).toMatchObject({ role: "system" });
    expect(messages[1].content).toContain("lesson.pdf");
    expect(messages[1].content).toContain("计划、组织、领导、控制");
    expect(JSON.stringify(messageInsertCalls[0])).not.toContain("lesson.pdf");
  });

  it("keeps study chat payload small for large courseware", async () => {
    studyMaterialLookup = { id: "material-1", conversation_id: null };
    studyMaterialsForConversation = [
      {
        file_name: "large-lesson.pptx",
        extracted_text: `${"重点内容".repeat(2300)}TAIL_SHOULD_BE_CLIPPED`,
      },
    ];
    messageHistoryRows = [
      { role: "assistant", content: "history-6" },
      { role: "user", content: "history-5" },
      { role: "assistant", content: "history-4" },
      { role: "user", content: "history-3" },
      { role: "assistant", content: "history-2" },
      { role: "user", content: "history-1" },
    ];

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          appId: "study",
          personaId: "study-helper",
          studyMaterialId: "material-1",
          message: "帮我总结核心考点",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await response.text();

    expect(messageHistoryLimitCalls[0]).toBe(4);
    const [messages, options] = vi.mocked(streamChatCompletion).mock.calls[0];
    const studyContext = messages[1];
    expect(options).toMatchObject({ timeoutMs: 180000 });
    expect(studyContext).toMatchObject({ role: "system" });
    expect(studyContext.content).toContain("large-lesson.pptx");
    expect(studyContext.content).not.toContain("TAIL_SHOULD_BE_CLIPPED");
    expect(studyContext.content.length).toBeLessThanOrEqual(8300);
    expect(messages.map((message) => message.content)).not.toContain("history-1");
    expect(messages.map((message) => message.content)).not.toContain("history-2");
    expect(messages.at(-1)).toEqual({ role: "user", content: "帮我总结核心考点" });
  });

  it("gives study users a specific recovery hint when the model times out", async () => {
    studyMaterialLookup = { id: "material-1", conversation_id: null };
    studyMaterialsForConversation = [{ file_name: "lesson.pptx", extracted_text: "很多课件文字" }];
    vi.mocked(streamChatCompletion).mockImplementationOnce(async function* () {
      throw new Error("AI 服务响应超时，请稍后重试。");
    });

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          appId: "study",
          personaId: "study-helper",
          studyMaterialId: "material-1",
          message: "帮我总结这份课件",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const text = await response.text();

    expect(text).toContain("课件内容比较多，AI 处理超时了");
    expect(text).toContain("用 8 条总结核心考点");
    expect(messageInsertCalls).toHaveLength(0);
  });

  it("rejects study materials that are missing or not owned by the user", async () => {
    studyMaterialLookup = null;

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          appId: "study",
          personaId: "study-helper",
          studyMaterialId: "material-404",
          message: "请帮我总结这份课件",
        }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "课件不存在或已失效。" });
    expect(streamChatCompletion).not.toHaveBeenCalled();
  });
});
