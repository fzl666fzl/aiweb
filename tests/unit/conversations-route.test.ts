import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/conversations/route";

const eqCalls: Array<[string, string]> = [];
const insertCalls: unknown[] = [];

vi.mock("@/lib/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ accessKeyId: "access-1", visitorId: "visitor-1" }),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseAdmin: vi.fn(() => ({
    from(table: string) {
      if (table !== "conversations") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const listBuilder = {
        eq(column: string, value: string) {
          eqCalls.push([column, value]);
          return listBuilder;
        },
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "c1",
              title: "怎么做产品",
              app_id: "celebrities",
              persona_id: "zhang-yiming",
              created_at: "2026-05-21T00:00:00.000Z",
              updated_at: "2026-05-21T00:00:00.000Z",
            },
          ],
          error: null,
        }),
      };

      return {
        select: vi.fn(() => listBuilder),
        insert: vi.fn((row: unknown) => {
          insertCalls.push(row);
          return {
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "c2",
                  title: "新会话",
                  app_id: "celebrities",
                  persona_id: "munger",
                  created_at: "2026-05-21T00:00:00.000Z",
                  updated_at: "2026-05-21T00:00:00.000Z",
                },
                error: null,
              }),
            })),
          };
        }),
      };
    },
  })),
}));

describe("conversations route", () => {
  beforeEach(() => {
    eqCalls.length = 0;
    insertCalls.length = 0;
  });

  it("filters conversation history by app id", async () => {
    const response = await GET(new Request("http://localhost/api/conversations?appId=celebrities"));

    expect(response.status).toBe(200);
    expect(eqCalls).toContainEqual(["app_id", "celebrities"]);
    await expect(response.json()).resolves.toMatchObject({
      conversations: [{ app_id: "celebrities", persona_id: "zhang-yiming" }],
    });
  });

  it("stores app and persona ids when creating a celebrity conversation", async () => {
    const response = await POST(
      new Request("http://localhost/api/conversations", {
        method: "POST",
        body: JSON.stringify({ appId: "celebrities", personaId: "munger", title: "新会话" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(insertCalls[0]).toMatchObject({
      access_key_id: "access-1",
      visitor_id: "visitor-1",
      app_id: "celebrities",
      persona_id: "munger",
      title: "新会话",
    });
  });
});
