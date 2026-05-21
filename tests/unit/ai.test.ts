import { describe, expect, it, vi } from "vitest";
import { callChatCompletion, streamChatCompletion } from "@/lib/ai";

async function collectStream(stream: AsyncIterable<string>) {
  const chunks: string[] = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return chunks;
}

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

  it("throws a specific timeout error when the upstream request is aborted", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });

    const request = callChatCompletion([{ role: "user", content: "hello" }], {
      baseUrl: "https://api.example.com/v1",
      apiKey: "key",
      model: "gpt-5.5",
      fetchImpl: fetchMock,
    });

    const assertion = expect(request).rejects.toThrow("AI 服务响应超时，请稍后重试。");

    await vi.runAllTimersAsync();
    await assertion;
    vi.useRealTimers();
  });
});

describe("streamChatCompletion", () => {
  it("sends OpenAI-compatible streaming chat payload and yields delta chunks", async () => {
    const encoder = new TextEncoder();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"你"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"好"}}]}\n\n'));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      }),
    });

    const chunks = await collectStream(
      streamChatCompletion([{ role: "user", content: "hello" }], {
        baseUrl: "https://api.example.com/v1",
        apiKey: "key",
        model: "gpt-5.5",
        fetchImpl: fetchMock,
      }),
    );

    expect(chunks).toEqual(["你", "好"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer key" }),
        body: JSON.stringify({
          model: "gpt-5.5",
          messages: [{ role: "user", content: "hello" }],
          stream: true,
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
