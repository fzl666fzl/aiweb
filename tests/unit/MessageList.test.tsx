import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MessageList } from "@/components/MessageList";

describe("MessageList", () => {
  it("announces message additions and loading state to assistive technology", () => {
    render(
      <MessageList
        loading
        onPromptSelect={vi.fn()}
        messages={[
          {
            id: "m1",
            role: "assistant",
            content: "正在测试可访问状态",
            createdAt: new Date().toISOString(),
          },
        ]}
      />,
    );

    expect(screen.getByRole("log")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status", { name: "AI 正在认真读你说的话" })).toBeInTheDocument();
  });

  it("keeps long unbroken text inside message bubbles", () => {
    const longWord = "a".repeat(120);
    render(
      <MessageList
        loading={false}
        onPromptSelect={vi.fn()}
        messages={[
          {
            id: "m1",
            role: "user",
            content: longWord,
            createdAt: new Date().toISOString(),
          },
        ]}
      />,
    );

    expect(screen.getByText(longWord).className).toContain("break-words");
  });

  it("shows prompt cards in the empty workbench and returns the selected prompt", async () => {
    const onPromptSelect = vi.fn();
    render(<MessageList messages={[]} loading={false} onPromptSelect={onPromptSelect} />);

    expect(screen.getByRole("heading", { name: "今天想先说点什么？" })).toBeInTheDocument();
    expect(screen.getByText(/全国统一心理援助热线 12356/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /我有点累/ }));

    expect(onPromptSelect).toHaveBeenCalledWith("我有点累，但又说不清楚哪里累。请陪我慢慢梳理一下。");
  });

  it("copies assistant answers from the message toolbar", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <MessageList
        loading={false}
        onPromptSelect={vi.fn()}
        messages={[
          {
            id: "m1",
            role: "assistant",
            content: "这是可以复制的回答",
            createdAt: new Date().toISOString(),
          },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "复制回答" }));

    expect(writeText).toHaveBeenCalledWith("这是可以复制的回答");
  });

  it("renders assistant markdown headings instead of raw markdown markers", () => {
    const { container } = render(
      <MessageList
        loading={false}
        onPromptSelect={vi.fn()}
        messages={[
          {
            id: "m1",
            role: "assistant",
            content: "### 重点结论\n\n- 第一条\n- 第二条",
            createdAt: new Date().toISOString(),
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { level: 3, name: "重点结论" })).toBeInTheDocument();
    expect(container).not.toHaveTextContent("### 重点结论");
  });
});
