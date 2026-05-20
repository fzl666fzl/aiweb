import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/route";
import { hashAccessCode } from "@/lib/auth";

const eqCalls: Array<[string, unknown]> = [];

vi.mock("@/lib/env", () => ({
  getEnv: vi.fn((name: string) => {
    const values: Record<string, string> = {
      APP_ACCESS_SECRET: "test-secret",
    };
    return values[name] ?? "test";
  }),
}));

vi.mock("@/lib/session", () => ({
  getOrCreateVisitorId: vi.fn().mockResolvedValue("visitor-1"),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseAdmin: vi.fn(() => ({
    from: vi.fn(() => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: unknown) => {
          eqCalls.push([column, value]);
          return query;
        }),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
        single: vi.fn().mockResolvedValue({ data: { id: "access-1" }, error: null }),
      };

      return query;
    }),
  })),
}));

describe("auth route", () => {
  it("looks up the enabled access key by hashed access code", async () => {
    eqCalls.length = 0;

    const response = await POST(
      new Request("http://localhost/api/auth", {
        method: "POST",
        body: JSON.stringify({ code: " fzl666fzl " }),
      }),
    );

    expect(response.status).toBe(200);
    expect(eqCalls).toContainEqual(["key_hash", hashAccessCode("fzl666fzl", "test-secret")]);
    expect(eqCalls).toContainEqual(["enabled", true]);
  });
});
