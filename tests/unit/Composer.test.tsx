import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "@/components/Composer";

function ControlledComposer({
  disabled = false,
  onSend = vi.fn().mockResolvedValue(undefined),
}: {
  disabled?: boolean;
  onSend?: (message: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  return <Composer disabled={disabled} onSend={onSend} value={value} onChange={setValue} />;
}

describe("Composer", () => {
  it("sends the trimmed message when Enter is pressed", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<ControlledComposer onSend={onSend} />);

    await userEvent.type(screen.getByPlaceholderText("输入问题，或选择一个场景开始..."), "  你好  ");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(onSend).toHaveBeenCalledWith("你好"));
    expect(screen.getByPlaceholderText("输入问题，或选择一个场景开始...")).toHaveValue("");
  });

  it("keeps a newline when Shift+Enter is pressed", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<ControlledComposer onSend={onSend} />);

    await userEvent.type(screen.getByPlaceholderText("输入问题，或选择一个场景开始..."), "第一行");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("输入问题，或选择一个场景开始...")).toHaveValue("第一行\n");
  });

  it("does not send while Chinese input composition is active", () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<ControlledComposer onSend={onSend} />);

    const input = screen.getByPlaceholderText("输入问题，或选择一个场景开始...");
    fireEvent.change(input, { target: { value: "ni" } });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue("ni");
  });

  it("does not submit while disabled", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<ControlledComposer disabled onSend={onSend} />);

    fireEvent.submit(container.querySelector("form")!);

    expect(onSend).not.toHaveBeenCalled();
  });

  it("fills the composer from a scenario tag", async () => {
    render(<ControlledComposer />);

    await userEvent.click(screen.getByRole("button", { name: "总结" }));

    expect(screen.getByPlaceholderText("输入问题，或选择一个场景开始...")).toHaveValue(
      "请把下面的内容总结成 3 个重点：",
    );
  });
});
