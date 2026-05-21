import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatApp } from "@/components/ChatApp";
import { apiJson } from "@/lib/client-api";

vi.mock("@/lib/client-api", () => ({
  apiJson: vi.fn(),
}));

describe("ChatApp", () => {
  beforeEach(() => {
    vi.mocked(apiJson).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("announces chat errors with an alert", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockResolvedValueOnce({ conversations: [] });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "AI 服务暂时不可用，请稍后重试。" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(<ChatApp />);

    await userEvent.type(await screen.findByRole("textbox", { name: "消息输入" }), "hello");
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("AI 服务暂时不可用，请稍后重试。");
  });

  it("asks for an access code before loading conversations", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockRejectedValueOnce(new Error("访问尚未初始化，请先输入访问密码。"));
    apiMock.mockResolvedValueOnce({ ok: true });
    apiMock.mockResolvedValueOnce({ conversations: [] });

    render(<ChatApp />);

    await screen.findByRole("heading", { name: "欢迎回来，慢慢说" });
    await userEvent.type(screen.getByLabelText("访问密码"), "fzl666fzl");
    await userEvent.click(screen.getByRole("button", { name: "进入小站" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(3));
    expect(apiMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ code: "fzl666fzl" }) }),
    );
    expect(apiMock).toHaveBeenNthCalledWith(3, "/api/conversations?appId=mamanshuo");
  });

  it("streams assistant replies into the active message bubble", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockResolvedValueOnce({ conversations: [] });
    apiMock.mockResolvedValueOnce({ conversations: [] });

    const encoder = new TextEncoder();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('event: conversation\ndata: {"conversationId":"c1"}\n\n'));
            controller.enqueue(encoder.encode('event: delta\ndata: {"content":"你"}\n\n'));
            controller.enqueue(encoder.encode('event: delta\ndata: {"content":"好"}\n\n'));
            controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ChatApp />);

    await userEvent.type(await screen.findByRole("textbox", { name: "消息输入" }), "hello");
    await userEvent.keyboard("{Enter}");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/chat",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ appId: "mamanshuo", conversationId: null, message: "hello", personaId: "maman" }),
        }),
      ),
    );
    expect(await screen.findByText("你好")).toBeInTheDocument();
    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2));
    expect(apiMock).toHaveBeenNthCalledWith(2, "/api/conversations?appId=mamanshuo");
  });

  it("sends the selected celebrity persona with new chat messages", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockResolvedValueOnce({ conversations: [] });
    apiMock.mockResolvedValueOnce({ conversations: [] });

    const encoder = new TextEncoder();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('event: conversation\ndata: {"conversationId":"c1"}\n\n'));
            controller.enqueue(encoder.encode('event: delta\ndata: {"content":"可以"}\n\n'));
            controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ChatApp
        appId="celebrities"
        title="和名人对话"
        subtitle="选择一个视角来拆解问题。"
        statusLabel="顾问模式"
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: /张雪峰/ }));
    await userEvent.type(screen.getByRole("textbox", { name: "消息输入" }), "专业怎么选");
    await userEvent.keyboard("{Enter}");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/chat",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            appId: "celebrities",
            conversationId: null,
            message: "专业怎么选",
            personaId: "zhangxuefeng",
          }),
        }),
      ),
    );
  });
});
