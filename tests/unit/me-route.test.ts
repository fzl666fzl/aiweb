import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/me/route";
import { requireSession } from "@/lib/session";

const filters: Array<[string, unknown]> = [];
const usageFilters: Array<[string, unknown]> = [];
let userResult: { data: Record<string, unknown> | null; error: { code?: string; message: string } | null } = {
  data: { id: "user-1", email: "user@qq.com", membership_tier: "free", membership_expires_at: null },
  error: null,
};
let usageResult: { data: Record<string, unknown> | null; error: { code?: string; message: string } | null } = {
  data: null,
  error: null,
};

vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseAdmin: vi.fn(() => ({
    from(table: string) {
      if (table !== "app_users" && table !== "usage_logs") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const targetFilters = table === "usage_logs" ? usageFilters : filters;
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: unknown) => {
          targetFilters.push([column, value]);
          return query;
        }),
        limit: vi.fn(() => query),
        single: vi.fn(() => Promise.resolve(table === "usage_logs" ? usageResult : userResult)),
      };

      return query;
    },
  })),
}));

describe("me route", () => {
  beforeEach(() => {
    filters.length = 0;
    usageFilters.length = 0;
    userResult = { data: { id: "user-1", email: "user@qq.com", membership_tier: "free", membership_expires_at: null }, error: null };
    usageResult = { data: null, error: null };
    vi.mocked(requireSession).mockResolvedValue({ accessKeyId: "access-1", visitorId: "user:user-1" });
  });

  it("returns the current logged-in user email from storage", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(filters).toContainEqual(["access_key_id", "access-1"]);
    expect(filters).toContainEqual(["enabled", true]);
    await expect(response.json()).resolves.toEqual({
      user: {
        email: "user@qq.com",
        membership: {
          tierId: "free",
          name: "Free",
          monthlyMessageLimit: 50,
          monthlyMessagesUsed: 0,
          monthlyMessagesRemaining: 50,
          periodLabel: expect.stringMatching(/^\d{4}-\d{2}$/),
          expiresAt: null,
        },
      },
    });
  });

  it("returns membership tier and monthly usage for the current account", async () => {
    usageResult = { data: { request_count: 7 }, error: null };
    userResult = {
      data: { id: "user-1", email: "user@qq.com", membership_tier: "plus", membership_expires_at: "2999-01-01T00:00:00.000Z" },
      error: null,
    };

    const response = await GET();

    expect(response.status).toBe(200);
    expect(usageFilters).toContainEqual(["access_key_id", "access-1"]);
    expect(usageFilters).toContainEqual(["visitor_id", "user:user-1"]);
    expect(usageFilters.find(([column]) => column === "usage_date")?.[1]).toMatch(/^\d{4}-\d{2}-01$/);
    await expect(response.json()).resolves.toEqual({
      user: {
        email: "user@qq.com",
        membership: {
          tierId: "plus",
          name: "Plus",
          monthlyMessageLimit: 500,
          monthlyMessagesUsed: 7,
          monthlyMessagesRemaining: 493,
          periodLabel: expect.stringMatching(/^\d{4}-\d{2}$/),
          expiresAt: "2999-01-01T00:00:00.000Z",
        },
      },
    });
  });

  it("returns Free membership when a paid account is expired", async () => {
    userResult = {
      data: { id: "user-1", email: "user@qq.com", membership_tier: "plus", membership_expires_at: "2020-01-01T00:00:00.000Z" },
      error: null,
    };

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: {
        email: "user@qq.com",
        membership: {
          tierId: "free",
          name: "Free",
          monthlyMessageLimit: 50,
          monthlyMessagesUsed: 0,
          monthlyMessagesRemaining: 50,
          periodLabel: expect.stringMatching(/^\d{4}-\d{2}$/),
          expiresAt: null,
        },
      },
    });
  });

  it("returns 401 when the user is not logged in", async () => {
    vi.mocked(requireSession).mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "请先登录或注册账号。" });
  });
});
