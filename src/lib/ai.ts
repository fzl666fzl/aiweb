export type CompletionMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type CallOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type VisionMessage = {
  role: "user";
  content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >;
};

function getUpstreamErrorMessage(response: Response) {
  if (response.status === 401 || response.status === 403) {
    return "AI 服务认证失败，请检查中转站 API Key。";
  }

  return "AI 服务暂时不可用，请稍后重试。";
}

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
      throw new Error(getUpstreamErrorMessage(response));
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

export async function callVisionTextExtraction(image: { dataUrl: string; fileName: string }, options: CallOptions) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const fetcher = options.fetchImpl ?? fetch;
    const messages: VisionMessage[] = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `请只提取这张课件图片中的文字。文件名：${image.fileName}。不要总结，不要解释。`,
          },
          { type: "image_url", image_url: { url: image.dataUrl } },
        ],
      },
    ];
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
      throw new Error(getUpstreamErrorMessage(response));
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || content.trim().length === 0) {
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

export async function* streamChatCompletion(messages: CompletionMessage[], options: CallOptions) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 120000);

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
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(getUpstreamErrorMessage(response));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const parsed = parseOpenAIStreamBlock(block);

        for (const chunk of parsed.chunks) {
          yield chunk;
        }

        if (parsed.done) {
          return;
        }
      }
    }

    if (buffer) {
      const parsed = parseOpenAIStreamBlock(buffer);

      for (const chunk of parsed.chunks) {
        yield chunk;
      }
    }
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

function parseOpenAIStreamBlock(block: string) {
  const chunks: string[] = [];
  let done = false;

  for (const line of block.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed.startsWith("data:")) {
      continue;
    }

    const data = trimmed.slice(5).trim();

    if (!data) {
      continue;
    }

    if (data === "[DONE]") {
      done = true;
      continue;
    }

    const parsed = JSON.parse(data);
    const content = parsed?.choices?.[0]?.delta?.content;

    if (typeof content === "string" && content.length > 0) {
      chunks.push(content);
    }
  }

  return { chunks, done };
}
