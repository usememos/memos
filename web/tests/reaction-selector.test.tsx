import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReactionSelector from "@/components/MemoReactionListView/ReactionSelector";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

vi.mock("@/components/MemoReactionListView/hooks", () => ({
  useReactionActions: () => ({
    hasReacted: () => false,
    handleReactionClick: vi.fn(),
  }),
}));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ memoRelatedSetting: { reactions: ["👍"] } }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("ReactionSelector", () => {
  it("uses a named native trigger with a visible focus state", async () => {
    const memo = create(MemoSchema, { name: "memos/1", reactions: [] });
    render(<ReactionSelector memo={memo} />);

    const trigger = screen.getByRole("button", { name: "setting.memo.add-reaction" });
    expect(trigger).toHaveClass("size-7", "rounded-full", "focus-visible:ring-2");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
    expect(screen.getByRole("button", { name: "👍" })).toBeInTheDocument();
  });
});
