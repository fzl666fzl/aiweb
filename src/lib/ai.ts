type CompletionMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type CallOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
};

export async function callChatCompletion(messages: CompletionMessage[], options: CallOptions) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const fetcher = options.fetchImpl ?? fetch;
    const response = await fetcher(`${options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("AI 服务暂时不可用，请稍后重试。");
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || content.length === 0) {
      throw new Error("AI 服务返回为空，请稍后重试。");
    }

    return content;
  } catch (error) {
    if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") {
      throw new Error("AI 服务响应超时，请稍后重试。");
    }

    if (error instanceof Error && error.message.startsWith("AI 服务")) {
      throw error;
    }

    throw new Error("AI 服务暂时不可用，请稍后重试。");
  } finally {
    clearTimeout(timeout);
  }
}
