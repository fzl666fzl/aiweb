import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MessageList } from "@/components/MessageList";

describe("MessageList", () => {
  it("shows prompt cards in the empty workbench and returns the selected prompt", async () => {
    const onPromptSelect = vi.fn();
    render(<MessageList messages={[]} loading={false} onPromptSelect={onPromptSelect} />);

    expect(screen.getByRole("heading", { name: "今天想做点什么？" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /写一篇文案/ }));

    expect(onPromptSelect).toHaveBeenCalledWith("帮我写一篇小红书风格的产品介绍，语气自然一点。");
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
});
