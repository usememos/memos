import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MemoPinnedMark from "@/components/MemoView/components/MemoPinnedMark";

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("Memo pinned mark", () => {
  it("exposes the pinned state without adding an unpin button", () => {
    render(<MemoPinnedMark />);
    const mark = screen.getByRole("img", { name: "memo.pinned" });
    expect(mark.tagName).toBe("SPAN");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    fireEvent.click(mark);
    expect(mark).toBeInTheDocument();
    expect(mark).not.toHaveAttribute("tabindex", "0");
  });
});
