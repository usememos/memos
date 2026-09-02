import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MemoActionMenu from "@/components/MemoActionMenu";
import { State } from "@/types/proto/api/v1/common_pb";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const handlers = vi.hoisted(() => ({
  handleTogglePinMemoBtnClick: vi.fn(),
  handleEditMemoClick: vi.fn(),
  handleToggleMemoStatusClick: vi.fn(),
  handleCopyLink: vi.fn(),
  handleCopyContent: vi.fn(),
  handleCheckAllTaskListItemsClick: vi.fn(),
  handleUncheckAllTaskListItemsClick: vi.fn(),
  handleDeleteMemoClick: vi.fn(),
  confirmDeleteMemo: vi.fn(),
}));

vi.mock("@/components/ConfirmDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/MemoActionMenu/hooks", () => ({
  useMemoActionHandlers: () => handlers,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("MemoActionMenu", () => {
  it("uses the standard compact action surface and preserves its open state", async () => {
    const memo = create(MemoSchema, { name: "memos/1", state: State.NORMAL, pinned: false });
    render(<MemoActionMenu memo={memo} parentScope="preserve" />);

    const trigger = screen.getByRole("button", { name: "common.more" });
    expect(trigger).toHaveClass("size-6", "rounded-md", "hover:bg-accent", "focus-visible:ring-2", "data-popup-open:bg-accent");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger.querySelector(".lucide-ellipsis-vertical")).toHaveClass("size-4");

    fireEvent.click(trigger);

    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
    expect(trigger).toHaveAttribute("data-popup-open");
    expect(await screen.findByRole("menuitem", { name: "common.pin" })).toBeInTheDocument();
  });
});
