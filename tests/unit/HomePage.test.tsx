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
    apiMock.mockRejectedValueOnce(new Error("auth required"));
    apiMock.mockResolvedValueOnce({ ok: true });

    render(<Home />);

    expect(await screen.findByRole("heading", { name: "登录或注册" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "应用广场" })).not.toBeInTheDocument();
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
    expect(await screen.findByRole("heading", { name: "应用广场" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "进入慢慢说" })).toHaveAttribute("href", "/apps/mamanshuo");
  });

  it("shows the app hub when the account session already exists", async () => {
    vi.mocked(apiJson).mockResolvedValueOnce({ conversations: [] });

    render(<Home />);

    expect(await screen.findByRole("heading", { name: "应用广场" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "登录或注册" })).not.toBeInTheDocument();
  });
});
