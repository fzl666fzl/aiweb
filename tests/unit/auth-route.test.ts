import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/route";
import { hashPassword } from "@/lib/account-auth";
import { hashAccessCode } from "@/lib/auth";

const eqCalls: Array<[string, unknown]> = [];
type QueryState = {
  table: string;
  filters: Array<[string, unknown]>;
  inserted: unknown;
};

const queries: QueryState[] = [];
let singleResult: { data: Record<string, unknown> | null; error: { code?: string; message: string } | null } = {
  data: { id: "access-1" },
  error: null,
};
let singleHandler: (query: QueryState) => Promise<typeof singleResult> = async () => singleResult;

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
    from: vi.fn((table: string) => {
      const state: QueryState = { table, filters: [], inserted: null };
      queries.push(state);
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: unknown) => {
          state.filters.push([column, value]);
          eqCalls.push([column, value]);
          return query;
        }),
        insert: vi.fn((value: unknown) => {
          state.inserted = value;
          return query;
        }),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
        single: vi.fn(() => singleHandler(state)),
      };

      return query;
    }),
  })),
}));

describe("auth route", () => {
  it("looks up the enabled access key by hashed access code", async () => {
    eqCalls.length = 0;
    queries.length = 0;
    singleResult = { data: { id: "access-1" }, error: null };
    singleHandler = async () => singleResult;

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
    singleHandler = async () => singleResult;

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

  it("rejects non-qq email registration before touching storage", async () => {
    queries.length = 0;

    const response = await POST(
      new Request("http://localhost/api/auth", {
        method: "POST",
        body: JSON.stringify({ mode: "register", email: "user@gmail.com", password: "password123" }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ error: "注册账号只能使用 QQ 邮箱。" });
    expect(response.status).toBe(400);
    expect(queries).toHaveLength(0);
  });

  it("creates an account for qq email registration and sets account cookies", async () => {
    queries.length = 0;
    singleHandler = async (query) => {
      if (query.table === "app_users" && !query.inserted) {
        return { data: null, error: { code: "PGRST116", message: "not found" } };
      }

      if (query.table === "access_keys" && query.inserted) {
        return { data: { id: "access-account-1" }, error: null };
      }

      if (query.table === "app_users" && query.inserted) {
        return { data: { id: "user-1", access_key_id: "access-account-1" }, error: null };
      }

      return { data: null, error: null };
    };

    const response = await POST(
      new Request("http://localhost/api/auth", {
        method: "POST",
        body: JSON.stringify({ mode: "register", email: " User@qq.com ", password: "password123" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(queries.find((query) => query.table === "app_users" && query.inserted)?.inserted).toMatchObject({
      access_key_id: "access-account-1",
      email: "user@qq.com",
      membership_tier: "free",
    });
    expect(response.headers.get("set-cookie")).toContain("aiweb_visitor=user%3Auser-1");
  });

  it("logs in an existing qq email account with the correct password", async () => {
    queries.length = 0;
    const password = hashPassword("password123");
    singleHandler = async (query) => {
      if (query.table === "app_users") {
        return {
          data: {
            id: "user-1",
            access_key_id: "access-account-1",
            password_hash: password.passwordHash,
            password_salt: password.passwordSalt,
          },
          error: null,
        };
      }

      return { data: null, error: null };
    };

    const response = await POST(
      new Request("http://localhost/api/auth", {
        method: "POST",
        body: JSON.stringify({ mode: "login", email: "user@qq.com", password: "password123" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(queries.at(0)?.filters).toContainEqual(["email", "user@qq.com"]);
    expect(response.headers.get("set-cookie")).toContain("aiweb_visitor=user%3Auser-1");
  });

  it("rejects login with the wrong password", async () => {
    const password = hashPassword("password123");
    singleHandler = async () => ({
      data: {
        id: "user-1",
        access_key_id: "access-account-1",
        password_hash: password.passwordHash,
        password_salt: password.passwordSalt,
      },
      error: null,
    });

    const response = await POST(
      new Request("http://localhost/api/auth", {
        method: "POST",
        body: JSON.stringify({ mode: "login", email: "user@qq.com", password: "wrong-password" }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ error: "邮箱或密码不正确。" });
    expect(response.status).toBe(401);
  });
});
