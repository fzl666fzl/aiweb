import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/route";
import { streamChatCompletion } from "@/lib/ai";

const messageInsertCalls: unknown[] = [];
const conversationInsertCalls: unknown[] = [];
let existingConversation: { id: string; app_id: string; persona_id: string } | null = null;

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
    rpc: vi.fn(() => {
      throw new Error("quota rpc should not be called");
    }),
    from(table: string) {
      if (table === "access_keys" || table === "usage_logs") {
        throw new Error(`${table} should not be queried`);
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
                limit: vi.fn().mockResolvedValue({ data: [] }),
              })),
            })),
          })),
          insert: vi.fn((rows: unknown) => {
            messageInsertCalls.push(rows);
            return Promise.resolve({ error: null });
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
    existingConversation = null;
    vi.mocked(streamChatCompletion).mockClear();
  });

  it("streams messages without checking access key or usage quota", async () => {
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
    expect(messages[0].content).toContain("4 到 7 个自然段");
    expect(messages[0].content).toContain("450 个汉字");
    expect(messages[0].content).toContain("先充分回应，再给小建议");
    expect(messages[0].content).toContain("轻轻的问题");
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
});
