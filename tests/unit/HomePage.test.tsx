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

  it("shows the account registration entry before users choose an app", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockRejectedValueOnce(new Error("auth required"));
    apiMock.mockResolvedValueOnce({ ok: true });

    render(<Home />);

    const accountPanel = await screen.findByRole("complementary", { name: "账号入口" });
    expect(accountPanel).toBeInTheDocument();
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
    expect(await screen.findByText("已登录")).toBeInTheDocument();
  });
});
