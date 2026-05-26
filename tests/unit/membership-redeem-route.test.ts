import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/membership/redeem/route";
import { hashAccessCode } from "@/lib/auth";
import { requireSession } from "@/lib/session";

const userFilters: Array<[string, unknown]> = [];
const codeFilters: Array<[string, unknown]> = [];
const userUpdates: unknown[] = [];
const codeUpdates: unknown[] = [];

let userResult: { data: Record<string, unknown> | null; error: { code?: string; message: string } | null } = {
  data: {
    id: "user-1",
    email: "user@qq.com",
    membership_expires_at: null,
    membership_tier: "free",
  },
  error: null,
};
let codeResult: { data: Record<string, unknown> | null; error: { code?: string; message: string } | null } = {
  data: {
    id: "code-1",
    duration_days: 31,
    tier: "plus",
  },
  error: null,
};

vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getEnv: vi.fn((name: string) => (name === "APP_ACCESS_SECRET" ? "test-secret" : "test")),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseAdmin: vi.fn(() => ({
    from(table: string) {
      if (table === "app_users") {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn((column: string, value: unknown) => {
            userFilters.push([column, value]);
            return query;
          }),
          limit: vi.fn(() => query),
          single: vi.fn(() => Promise.resolve(userResult)),
          update: vi.fn((values: unknown) => {
            userUpdates.push(values);
            return {
              eq: vi.fn(() => Promise.resolve({ error: null })),
            };
          }),
        };

        return query;
      }

      if (table === "membership_codes") {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn((column: string, value: unknown) => {
            codeFilters.push([column, value]);
            return query;
          }),
          is: vi.fn((column: string, value: unknown) => {
            codeFilters.push([column, value]);
            return query;
          }),
          limit: vi.fn(() => query),
          single: vi.fn(() => Promise.resolve(codeResult)),
          update: vi.fn((values: unknown) => {
            codeUpdates.push(values);
            return {
              eq: vi.fn(() => Promise.resolve({ error: null })),
            };
          }),
        };

        return query;
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  })),
}));

describe("membership redeem route", () => {
  beforeEach(() => {
    userFilters.length = 0;
    codeFilters.length = 0;
    userUpdates.length = 0;
    codeUpdates.length = 0;
    userResult = {
      data: {
        id: "user-1",
        email: "user@qq.com",
        membership_expires_at: null,
        membership_tier: "free",
      },
      error: null,
    };
    codeResult = {
      data: {
        id: "code-1",
        duration_days: 31,
        tier: "plus",
      },
      error: null,
    };
    vi.mocked(requireSession).mockResolvedValue({ accessKeyId: "access-1", visitorId: "user:user-1" });
  });

  it("returns 401 when the user is not authenticated", async () => {
    vi.mocked(requireSession).mockResolvedValueOnce(null);

    const response = await POST(
      new Request("http://localhost/api/membership/redeem", {
        method: "POST",
        body: JSON.stringify({ code: "AIWEB-PLUS-123456" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "请先登录后再兑换会员。" });
  });

  it("rejects empty redeem codes", async () => {
    const response = await POST(
      new Request("http://localhost/api/membership/redeem", {
        method: "POST",
        body: JSON.stringify({ code: " " }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "请输入兑换码。" });
  });

  it("rejects invalid or used redeem codes", async () => {
    codeResult = { data: null, error: { code: "PGRST116", message: "not found" } };

    const response = await POST(
      new Request("http://localhost/api/membership/redeem", {
        method: "POST",
        body: JSON.stringify({ code: "AIWEB-PLUS-MISSING" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "兑换码无效或已使用。" });
  });

  it("redeems a valid code and returns the refreshed membership summary", async () => {
    const response = await POST(
      new Request("http://localhost/api/membership/redeem", {
        method: "POST",
        body: JSON.stringify({ code: " aiweb-plus-abc123 " }),
      }),
    );

    expect(response.status).toBe(200);
    expect(userFilters).toContainEqual(["access_key_id", "access-1"]);
    expect(codeFilters).toContainEqual(["code_hash", hashAccessCode("aiweb-plus-abc123", "test-secret")]);
    expect(codeFilters).toContainEqual(["redeemed_at", null]);
    expect(userUpdates[0]).toMatchObject({ membership_tier: "plus" });
    expect(codeUpdates[0]).toMatchObject({ redeemed_by_user_id: "user-1" });
    await expect(response.json()).resolves.toMatchObject({
      membership: {
        tierId: "plus",
        name: "Plus",
        monthlyMessageLimit: 500,
        monthlyMessagesUsed: 0,
        monthlyMessagesRemaining: 500,
      },
    });
  });
});
