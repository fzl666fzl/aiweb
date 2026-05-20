import { describe, expect, it } from "vitest";
import { validateUserMessage } from "@/lib/limits";

describe("message validation", () => {
  it("rejects empty messages", () => {
    expect(validateUserMessage("   ")).toEqual({
      ok: false,
      status: 400,
      message: "请输入问题。",
    });
  });

  it("rejects messages over 4000 characters", () => {
    expect(validateUserMessage("a".repeat(4001))).toEqual({
      ok: false,
      status: 400,
      message: "单次提问不能超过 4000 个字符。",
    });
  });

  it("accepts valid messages and trims whitespace", () => {
    expect(validateUserMessage(" hello ")).toEqual({ ok: true, value: "hello" });
  });
});
