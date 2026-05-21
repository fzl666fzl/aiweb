import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/route";
import { streamChatCompletion } from "@/lib/ai";

const messageInsertCalls: unknown[] = [];

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
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { id: "conversation-1" }, error: null }),
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
    expect(text).toContain('event: conversation\ndata: {"conversationId":"conversation-1"}');
    expect(text).toContain('event: delta\ndata: {"content":"测试"}');
    expect(text).toContain('event: delta\ndata: {"content":"回答"}');
    expect(text).toContain("event: done");
    expect(streamChatCompletion).toHaveBeenCalled();
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
    expect(messages[0].content).toContain("3 到 5 个自然段");
    expect(messages[0].content).toContain("轻轻的问题");
    expect(messages.at(-1)).toEqual({ role: "user", content: "我最近很累" });
    expect(JSON.stringify(messageInsertCalls[0])).not.toContain("\"role\":\"system\"");
  });
});
