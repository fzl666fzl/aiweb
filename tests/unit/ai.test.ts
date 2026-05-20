import { describe, expect, it, vi } from "vitest";
import { callChatCompletion } from "@/lib/ai";

describe("callChatCompletion", () => {
  it("sends OpenAI-compatible non-streaming chat payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "answer" } }] }),
    });

    const content = await callChatCompletion([{ role: "user", content: "hello" }], {
      baseUrl: "https://api.example.com/v1",
      apiKey: "key",
      model: "gpt-5.5",
      fetchImpl: fetchMock,
    });

    expect(content).toBe("answer");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer key" }),
        body: JSON.stringify({
          model: "gpt-5.5",
          messages: [{ role: "user", content: "hello" }],
          stream: false,
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("throws a friendly upstream error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "bad",
    });

    await expect(
      callChatCompletion([{ role: "user", content: "hello" }], {
        baseUrl: "https://api.example.com/v1",
        apiKey: "key",
        model: "gpt-5.5",
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow("AI 服务暂时不可用，请稍后重试。");
  });
});
