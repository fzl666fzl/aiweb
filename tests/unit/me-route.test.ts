import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/me/route";
import { requireSession } from "@/lib/session";

const filters: Array<[string, unknown]> = [];
let userResult: { data: Record<string, unknown> | null; error: { code?: string; message: string } | null } = {
  data: { email: "user@qq.com" },
  error: null,
};

vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseAdmin: vi.fn(() => ({
    from(table: string) {
      if (table !== "app_users") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: unknown) => {
          filters.push([column, value]);
          return query;
        }),
        limit: vi.fn(() => query),
        single: vi.fn(() => Promise.resolve(userResult)),
      };

      return query;
    },
  })),
}));

describe("me route", () => {
  beforeEach(() => {
    filters.length = 0;
    userResult = { data: { email: "user@qq.com" }, error: null };
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
