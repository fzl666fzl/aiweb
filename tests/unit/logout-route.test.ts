import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/logout/route";
import { AUTH_COOKIE, VISITOR_COOKIE } from "@/lib/auth";

describe("logout route", () => {
  it("clears the auth and visitor cookies", async () => {
    const response = await POST();
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(setCookie).toContain(AUTH_COOKIE);
    expect(setCookie).toContain(VISITOR_COOKIE);
    expect(setCookie.toLowerCase()).toContain("expires=thu, 01 jan 1970");
  });
});
