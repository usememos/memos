import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FocusModeExitButton } from "@/components/MemoEditor/edit/components/FocusModeOverlay";

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

describe("FocusModeExitButton", () => {
  it("minimizes inline focus mode", () => {
    const onExit = vi.fn();
    render(<FocusModeExitButton action="minimize" onExit={onExit} />);
    fireEvent.click(screen.getByRole("button", { name: "editor.exit-focus-mode" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("reads as Close when a host owns the frame", () => {
    render(<FocusModeExitButton action="close" onExit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "common.close" })).toBeInTheDocument();
  });
});
