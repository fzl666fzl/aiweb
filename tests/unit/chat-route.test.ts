import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/route";
import { callChatCompletion } from "@/lib/ai";

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
  callChatCompletion: vi.fn().mockResolvedValue("测试回答"),
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
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  })),
}));

describe("chat route", () => {
  it("sends messages without checking access key or usage quota", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: "你好" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      conversationId: "conversation-1",
      assistantMessage: { content: "测试回答" },
    });
    expect(callChatCompletion).toHaveBeenCalled();
  });
});
