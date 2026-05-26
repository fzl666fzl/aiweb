import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MembershipPlans } from "@/components/MembershipPlans";
import { apiJson } from "@/lib/client-api";

vi.mock("@/lib/client-api", () => ({
  apiJson: vi.fn(),
}));

const refresh = vi.fn();

vi.mock("@/components/SessionProvider", () => ({
  useSession: () => ({ refresh }),
}));

const usage = {
  expiresAt: "2999-01-01T00:00:00.000Z",
  monthlyMessageLimit: 500,
  monthlyMessagesRemaining: 488,
  monthlyMessagesUsed: 12,
  name: "Plus",
  periodLabel: "2026-05",
  tierId: "plus" as const,
};

describe("MembershipPlans", () => {
  it("shows current usage and opens recharge options in a modal", async () => {
    render(<MembershipPlans currentTierId="plus" usage={usage} />);

    expect(screen.getByRole("heading", { name: "会员额度" })).toBeInTheDocument();
    expect(screen.getByText("本月已用 12 / 500")).toBeInTheDocument();
    expect(screen.getByText("剩余 488 次")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "充值或升级会员" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "充值 / 升级" }));

    expect(screen.getByRole("dialog", { name: "充值或升级会员" })).toBeInTheDocument();
    expect(screen.getByText("Plus")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByLabelText("兑换码")).toBeInTheDocument();
  });

  it("submits redeem codes and refreshes the session", async () => {
    vi.mocked(apiJson).mockResolvedValueOnce({ membership: usage });
    render(<MembershipPlans currentTierId="plus" usage={usage} />);

    await userEvent.click(screen.getByRole("button", { name: "充值 / 升级" }));
    await userEvent.type(screen.getByLabelText("兑换码"), "AIWEB-PLUS-ABC123");
    await userEvent.click(screen.getByRole("button", { name: "兑换会员" }));

    expect(apiJson).toHaveBeenCalledWith("/api/membership/redeem", {
      body: JSON.stringify({ code: "AIWEB-PLUS-ABC123" }),
      method: "POST",
    });
    expect(await screen.findByText("兑换成功，会员额度已刷新。")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});
