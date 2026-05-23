import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatApp } from "@/components/ChatApp";
import { SessionProvider } from "@/components/SessionProvider";
import { apiJson } from "@/lib/client-api";

vi.mock("@/lib/client-api", () => ({
  apiJson: vi.fn(),
}));

describe("ChatApp", () => {
  beforeEach(() => {
    vi.mocked(apiJson).mockReset();
    window.localStorage.clear();
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

  it("shows a friendly prompt when the login session expires", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockResolvedValueOnce({ conversations: [] });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "请先登录或注册账号。" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(<ChatApp />);

    await userEvent.type(await screen.findByRole("textbox", { name: "消息输入" }), "hello");
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("登录状态已过期，请重新登录后再试。");
  });

  it("registers a qq email account before loading conversations", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockRejectedValueOnce(new Error("访问尚未初始化，请先登录或注册账号。"));
    apiMock.mockResolvedValueOnce({ ok: true });
    apiMock.mockResolvedValueOnce({ conversations: [] });

    render(<ChatApp />);

    await screen.findByRole("heading", { name: "欢迎回来，慢慢说" });
    await userEvent.click(screen.getByRole("button", { name: "注册" }));
    await userEvent.type(screen.getByLabelText("QQ 邮箱"), "user@qq.com");
    await userEvent.type(screen.getByLabelText("密码"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "注册账号" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(3));
    expect(apiMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mode: "register", email: "user@qq.com", password: "password123" }),
      }),
    );
    expect(apiMock).toHaveBeenNthCalledWith(3, "/api/conversations?appId=mamanshuo");
  });

  it("blocks non-qq email registration in the auth form", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockRejectedValueOnce(new Error("访问尚未初始化，请先登录或注册账号。"));

    render(<ChatApp />);

    await screen.findByRole("heading", { name: "欢迎回来，慢慢说" });
    await userEvent.click(screen.getByRole("button", { name: "注册" }));
    await userEvent.type(screen.getByLabelText("QQ 邮箱"), "user@gmail.com");
    await userEvent.type(screen.getByLabelText("密码"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "注册账号" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("注册账号只能使用 QQ 邮箱。");
    expect(apiMock).toHaveBeenCalledTimes(1);
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

  it("fills quick prompts into the input without sending", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockResolvedValueOnce({ conversations: [] });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ChatApp />);

    await userEvent.click(await screen.findByRole("button", { name: "有点累" }));

    expect(screen.getByRole("textbox", { name: "消息输入" })).toHaveValue(
      "我有点累，但又说不清楚哪里累。请陪我慢慢梳理一下。",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prefills the input from the prompt query string", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockResolvedValueOnce({ conversations: [] });
    window.history.pushState({}, "", "/apps/mamanshuo?prompt=%E6%88%91%E6%9C%89%E7%82%B9%E7%B4%AF");

    render(<ChatApp />);

    expect(await screen.findByRole("textbox", { name: "消息输入" })).toHaveValue("我有点累");
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

    const sidebar = await screen.findByRole("complementary", { name: "人物和历史侧栏" });
    await userEvent.click(within(sidebar).getByRole("button", { name: /张雪峰/ }));
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

  it("shows celebrity quick prompts for the selected advisor", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockResolvedValueOnce({ conversations: [] });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ChatApp
        appId="celebrities"
        title="和名人对话"
        subtitle="选择一个视角来拆解问题。"
        statusLabel="顾问模式"
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "如何判断产品方向？" }));

    expect(screen.getByRole("textbox", { name: "消息输入" })).toHaveValue(
      "我有一个产品方向，想请你从用户价值、长期趋势和执行路径帮我判断是否值得做。",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens the celebrity advisor picker from the center empty-state icon", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockResolvedValueOnce({ conversations: [] });

    render(
      <ChatApp
        appId="celebrities"
        title="和名人对话"
        subtitle="选择一个视角来拆解问题。"
        statusLabel="顾问模式"
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "选择名人顾问" }));
    const dialog = screen.getByRole("dialog", { name: "选择名人顾问" });

    expect(within(dialog).getByText("选择顾问")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /张雪峰/ }));

    expect(screen.queryByRole("dialog", { name: "选择名人顾问" })).not.toBeInTheDocument();
    expect(screen.getByText(/当前顾问：张雪峰/)).toBeInTheDocument();
  });

  it("keeps celebrity personas in the left sidebar and lets the sidebar collapse", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockResolvedValueOnce({ conversations: [] });

    render(
      <ChatApp
        appId="celebrities"
        title="和名人对话"
        subtitle="选择一个视角来拆解问题。"
        statusLabel="顾问模式"
      />,
    );

    const sidebar = await screen.findByRole("complementary", { name: "人物和历史侧栏" });
    expect(screen.queryByRole("region", { name: "选择名人顾问" })).not.toBeInTheDocument();
    expect(within(sidebar).getByText(/当前视角：张一鸣/)).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /张雪峰/ })).toBeInTheDocument();

    await userEvent.click(within(sidebar).getByRole("button", { name: "收起人物" }));
    expect(within(sidebar).queryByRole("button", { name: /张雪峰/ })).not.toBeInTheDocument();
    await userEvent.click(within(sidebar).getByRole("button", { name: "展开人物" }));
    await userEvent.click(within(sidebar).getByRole("button", { name: /张雪峰/ }));
    expect(within(sidebar).getByText(/当前视角：张雪峰/)).toBeInTheDocument();

    await userEvent.click(within(sidebar).getByRole("button", { name: "收起侧栏" }));
    expect(screen.getByRole("button", { name: "展开侧栏" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "人物和历史侧栏" })).not.toBeInTheDocument();
  });

  it("links chat pages back to the app hub", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockResolvedValueOnce({ conversations: [] });

    render(
      <ChatApp
        appId="celebrities"
        title="和名人对话"
        subtitle="选择一个视角来拆解问题。"
        statusLabel="顾问模式"
      />,
    );

    await screen.findByRole("heading", { name: "和名人对话" });

    const homeLinks = screen.getAllByRole("link", { name: "返回首页" });
    expect(homeLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of homeLinks) {
      expect(link).toHaveAttribute("href", "/");
    }
  });

  it("shows the logged-in account on chat pages and returns to auth after logout", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockImplementation((input) => {
      if (input === "/api/me") {
        return Promise.resolve({ user: { email: "user@qq.com" } });
      }

      if (input === "/api/logout") {
        return Promise.resolve({ ok: true });
      }

      return Promise.resolve({ conversations: [] });
    });

    render(
      <SessionProvider>
        <ChatApp />
      </SessionProvider>,
    );

    expect(await screen.findByText("user@qq.com")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "退出登录" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/api/logout", { method: "POST" }));
    expect(await screen.findByRole("heading", { name: "欢迎回来，慢慢说" })).toBeInTheDocument();
  });

  it("refreshes the account state after authenticating on a chat page", async () => {
    const apiMock = vi.mocked(apiJson);
    let authenticated = false;
    apiMock.mockImplementation((input, init) => {
      if (input === "/api/auth") {
        authenticated = true;
        return Promise.resolve({ ok: true });
      }

      if (input === "/api/me") {
        return authenticated
          ? Promise.resolve({ user: { email: "user@qq.com" } })
          : Promise.reject(new Error("请先登录或注册账号。"));
      }

      if (typeof input === "string" && input.startsWith("/api/conversations")) {
        return authenticated
          ? Promise.resolve({ conversations: [] })
          : Promise.reject(new Error("请先登录或注册账号。"));
      }

      return Promise.reject(new Error(`unexpected request ${String(input)} ${init?.method ?? "GET"}`));
    });

    render(
      <SessionProvider>
        <ChatApp />
      </SessionProvider>,
    );

    await screen.findByRole("heading", { name: "欢迎回来，慢慢说" });
    await userEvent.click(screen.getByRole("button", { name: "注册" }));
    await userEvent.type(screen.getByLabelText("QQ 邮箱"), "user@qq.com");
    await userEvent.type(screen.getByLabelText("密码"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "注册账号" }));

    expect(await screen.findByText("user@qq.com")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "欢迎回来，慢慢说" })).not.toBeInTheDocument();
  });

  it("lets celebrity users resize the left sidebar and remembers the width", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockResolvedValueOnce({ conversations: [] });
    window.localStorage.setItem("celebrities-sidebar-width", "344");

    render(
      <ChatApp
        appId="celebrities"
        title="和名人对话"
        subtitle="选择一个视角来拆解问题。"
        statusLabel="顾问模式"
      />,
    );

    const sidebar = await screen.findByRole("complementary", { name: "人物和历史侧栏" });
    await waitFor(() => expect(sidebar.parentElement).toHaveStyle({ width: "344px" }));

    const resizeHandle = screen.getByRole("separator", { name: "调整侧栏宽度" });
    fireEvent.keyDown(resizeHandle, { key: "ArrowRight" });

    await waitFor(() => expect(sidebar.parentElement).toHaveStyle({ width: "368px" }));
    expect(window.localStorage.getItem("celebrities-sidebar-width")).toBe("368");
  });
});
