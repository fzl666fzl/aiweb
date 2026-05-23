import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { apiJson } from "@/lib/client-api";

vi.mock("@/lib/client-api", () => ({
  apiJson: vi.fn(),
}));

describe("home page", () => {
  beforeEach(() => {
    vi.mocked(apiJson).mockReset();
  });

  it("gates the home page behind the account registration flow", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockRejectedValueOnce(new Error("请先登录或注册账号。"));
    apiMock.mockResolvedValueOnce({ ok: true });
    apiMock.mockResolvedValueOnce({ user: { email: "user@qq.com" } });

    render(<Home />);

    expect(await screen.findByRole("heading", { name: "登录或注册" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "聊天入口" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "进入慢慢说" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "注册" }));
    await userEvent.type(screen.getByLabelText("QQ 邮箱"), "user@qq.com");
    await userEvent.type(screen.getByLabelText("密码"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "注册账号" }));

    await waitFor(() =>
      expect(apiMock).toHaveBeenNthCalledWith(
        2,
        "/api/auth",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ mode: "register", email: "user@qq.com", password: "password123" }),
        }),
      ),
    );
    expect(await screen.findByRole("heading", { name: "聊天入口" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "进入慢慢说" })).toHaveAttribute("href", "/apps/mamanshuo");
    expect(screen.getByRole("button", { name: "退出登录" })).toBeInTheDocument();
    expect(screen.getByText("已登录")).toBeInTheDocument();
    expect(screen.getByText("user@qq.com")).toBeInTheDocument();
  });

  it("shows the app hub when the account session already exists", async () => {
    vi.mocked(apiJson).mockResolvedValueOnce({ user: { email: "user@qq.com" } });

    render(<Home />);

    expect(await screen.findByRole("heading", { name: "聊天入口" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "登录或注册" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "退出登录" })).toBeInTheDocument();
    expect(screen.getByText("已登录")).toBeInTheDocument();
    expect(screen.getByText("user@qq.com")).toBeInTheDocument();
  });

  it("links the header explanation button to the site instructions", async () => {
    vi.mocked(apiJson).mockResolvedValueOnce({ user: { email: "user@qq.com" } });

    render(<Home />);

    expect(await screen.findByRole("heading", { name: "使用说明" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "说明" })).toHaveAttribute("href", "#instructions");
    expect(screen.getByRole("link", { name: "入口" })).toHaveAttribute("href", "#apps");
    expect(screen.getByText(/慢慢说不是心理咨询或治疗服务。/)).toBeInTheDocument();
    expect(screen.getByText(/聊天历史会保存在你的账号下。/)).toBeInTheDocument();
  });

  it("logs out and returns to the login form", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockResolvedValueOnce({ user: { email: "user@qq.com" } });
    apiMock.mockResolvedValueOnce({ ok: true });

    render(<Home />);

    expect(await screen.findByRole("heading", { name: "聊天入口" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "退出登录" }));

    await waitFor(() => expect(apiMock).toHaveBeenNthCalledWith(2, "/api/logout", { method: "POST" }));
    expect(await screen.findByRole("heading", { name: "登录或注册" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "聊天入口" })).not.toBeInTheDocument();
  });

  it("links example questions into the matching chat app", async () => {
    vi.mocked(apiJson).mockResolvedValueOnce({ user: { email: "user@qq.com" } });

    render(<Home />);

    expect(await screen.findByRole("heading", { name: "聊天入口" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "我有点累" })).toHaveAttribute(
      "href",
      expect.stringContaining("/apps/mamanshuo?prompt="),
    );
    expect(screen.getByRole("link", { name: "我该怎么选专业？" })).toHaveAttribute("href", expect.stringContaining("/apps/celebrities?"));
    expect(screen.getByRole("link", { name: "我该怎么选专业？" })).toHaveAttribute(
      "href",
      expect.stringContaining("personaId=zhangxuefeng"),
    );
  });

  it("shows the study assistant app entry with example questions", async () => {
    vi.mocked(apiJson).mockResolvedValueOnce({ user: { email: "user@qq.com" } });

    render(<Home />);

    expect(await screen.findByRole("heading", { name: "复习助手" })).toBeInTheDocument();
    expect(screen.getByText("上传课件，帮你总结重点、整理考点、生成自测题。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "帮我总结课件" })).toHaveAttribute(
      "href",
      expect.stringContaining("/apps/study?prompt="),
    );
  });
});
