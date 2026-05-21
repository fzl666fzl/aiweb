import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/route";
import { hashAccessCode } from "@/lib/auth";

const eqCalls: Array<[string, unknown]> = [];
let singleResult: { data: { id: string } | null; error: { message: string } | null } = {
  data: { id: "access-1" },
  error: null,
};

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
        single: vi.fn(() => Promise.resolve(singleResult)),
      };

      return query;
    }),
  })),
}));

describe("auth route", () => {
  it("looks up the enabled access key by hashed access code", async () => {
    eqCalls.length = 0;
    singleResult = { data: { id: "access-1" }, error: null };

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

  it("returns a configuration error when the access key lookup fails", async () => {
    singleResult = { data: null, error: { message: "invalid api key" } };

    const response = await POST(
      new Request("http://localhost/api/auth", {
        method: "POST",
        body: JSON.stringify({ code: "fzl666fzl" }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "登录配置异常，请检查服务端配置。",
    });
    expect(response.status).toBe(500);
  });
});
