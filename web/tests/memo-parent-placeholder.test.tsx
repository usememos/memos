import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MemoParentPlaceholder from "@/components/MemoParentPlaceholder";

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

describe("unavailable parent", () => {
  it("has no navigation or retry for unavailable content", () => {
    render(<MemoParentPlaceholder status="unavailable" onRetry={vi.fn()} />);
    expect(screen.getByText("memo.parent-unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("offers Retry for transient failures", () => {
    const retry = vi.fn();
    render(<MemoParentPlaceholder status="error" onRetry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "search.retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
