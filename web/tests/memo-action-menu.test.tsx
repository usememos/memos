import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoActionMenu from "@/components/MemoActionMenu";
import { State } from "@/types/proto/api/v1/common_pb";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const handlers = vi.hoisted(() => ({
  canMove: true,
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

vi.mock("@/components/MemoActionMenu/MemoMoveDialog", () => ({
  default: () => <div role="dialog" aria-label="Move to Space" />,
}));

vi.mock("@/components/MemoActionMenu/hooks", () => ({
  useMemoActionHandlers: () => handlers,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("MemoActionMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.canMove = true;
  });

  it.each(["move", "delete"])("places %s inside More while keeping frequent actions in the main menu", async (action) => {
    render(<MemoActionMenu memo={create(MemoSchema, { name: "memos/1", state: State.NORMAL })} />);
    fireEvent.click(screen.getByRole("button", { name: "common.more" }));
    expect(await screen.findByRole("menuitem", { name: "common.edit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "common.archive" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "memo.move.title" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "common.delete" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "common.more" }));
    expect(await screen.findByRole("menuitem", { name: "memo.move.title" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "common.delete" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: action === "move" ? "memo.move.title" : "common.delete" }));
    if (action === "move") expect(await screen.findByRole("dialog", { name: "Move to Space" })).toBeInTheDocument();
    else expect(handlers.handleDeleteMemoClick).toHaveBeenCalledOnce();
  });

  it("omits More when neither action is available", async () => {
    handlers.canMove = false;
    render(<MemoActionMenu memo={create(MemoSchema, { name: "memos/1", state: State.NORMAL })} readonly />);
    fireEvent.click(screen.getByRole("button", { name: "common.more" }));
    expect(await screen.findByRole("menuitem", { name: "common.copy" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "common.more" })).not.toBeInTheDocument();
  });

  it("shows comment actions with Delete last and no memo organization actions", async () => {
    render(<MemoActionMenu memo={create(MemoSchema, { name: "memos/2", parent: "memos/1", state: State.NORMAL })} />);
    fireEvent.click(screen.getByRole("button", { name: "common.more" }));
    await screen.findByRole("menuitem", { name: "common.edit" });

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["common.edit", "common.copy", "common.delete"]);
    expect(screen.getByRole("separator").nextElementSibling).toBe(screen.getByRole("menuitem", { name: "common.delete" }));

    fireEvent.click(screen.getByRole("menuitem", { name: "common.delete" }));
    expect(handlers.handleDeleteMemoClick).toHaveBeenCalledOnce();
    expect(handlers.confirmDeleteMemo).not.toHaveBeenCalled();
  });

  it.each([
    ["memo.copy-link", "handleCopyLink"],
    ["memo.copy-content", "handleCopyContent"],
  ] as const)("allows %s on a read-only comment", async (label, handler) => {
    render(<MemoActionMenu memo={create(MemoSchema, { name: "memos/2", parent: "memos/1", state: State.NORMAL })} readonly />);
    fireEvent.click(screen.getByRole("button", { name: "common.more" }));
    await screen.findByRole("menuitem", { name: "common.copy" });
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["common.copy"]);

    fireEvent.click(screen.getByRole("menuitem", { name: "common.copy" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: label }));
    expect(handlers[handler]).toHaveBeenCalledOnce();
  });

  it.each([false, true])("only shows task actions on writable task comments (readonly: %s)", async (readonly) => {
    const memo = create(MemoSchema, {
      name: "memos/2",
      parent: "memos/1",
      state: State.NORMAL,
      property: { hasTaskList: true, hasIncompleteTasks: true },
    });
    render(<MemoActionMenu memo={memo} readonly={readonly} />);
    fireEvent.click(screen.getByRole("button", { name: "common.more" }));
    await screen.findByRole("menuitem", { name: "common.copy" });

    if (readonly) {
      expect(screen.queryByRole("menuitem", { name: "memo.task-actions.title" })).not.toBeInTheDocument();
    } else {
      fireEvent.click(screen.getByRole("menuitem", { name: "memo.task-actions.title" }));
      expect(await screen.findByRole("menuitem", { name: "memo.task-actions.uncheck-all" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("menuitem", { name: "memo.task-actions.check-all" }));
      expect(handlers.handleCheckAllTaskListItemsClick).toHaveBeenCalledOnce();
    }
  });

  it("is a quiet compact control that takes the accent fill while open", async () => {
    const memo = create(MemoSchema, { name: "memos/1", state: State.NORMAL, pinned: false });
    render(<MemoActionMenu memo={memo} />);

    const trigger = screen.getByRole("button", { name: "common.more" });
    expect(trigger).toHaveClass("size-6", "rounded-md", "text-muted-foreground/70", "hover:bg-muted/60", "data-popup-open:bg-accent");
    expect(trigger.className).not.toMatch(/ring-/);
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger.querySelector(".lucide-ellipsis-vertical")).toHaveClass("size-4");

    fireEvent.click(trigger);

    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
    expect(trigger).toHaveAttribute("data-popup-open");
    expect(await screen.findByRole("menuitem", { name: "common.pin" })).toBeInTheDocument();
  });
});
