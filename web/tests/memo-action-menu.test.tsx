import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoActionMenu from "@/components/MemoActionMenu";
import { State } from "@/types/proto/api/v1/common_pb";
import { type Memo, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const handlers = vi.hoisted(() => ({
  canMove: true,
  isInMemoDetailPage: false,
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

const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}|{JSON.stringify(location.state)}
    </output>
  );
};

const openMenu = async (memo: Memo, props: { readonly?: boolean; parentPage?: string } = {}) => {
  render(
    <MemoryRouter initialEntries={["/explore"]}>
      <MemoActionMenu memo={memo} {...props} />
      <LocationProbe />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "common.more" }));
  await screen.findByRole("menuitem", { name: "common.copy" });
};

const menuItemLabels = () => screen.getAllByRole("menuitem").map((item) => item.textContent);

const memoOf = (fields: Parameters<typeof create<typeof MemoSchema>>[1] = {}) =>
  create(MemoSchema, { name: "memos/1", state: State.NORMAL, ...fields });

describe("MemoActionMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.canMove = false;
    handlers.isInMemoDetailPage = false;
  });

  it("orders an owner's memo actions and puts Delete last when Move does not apply", async () => {
    await openMenu(memoOf());
    expect(menuItemLabels()).toEqual(["common.open", "common.edit", "common.pin", "common.archive", "common.copy", "common.delete"]);
    const separators = screen.getAllByRole("separator");
    expect(separators[separators.length - 1].nextElementSibling).toBe(screen.getByRole("menuitem", { name: "common.delete" }));
  });

  it.each(["move", "delete"])("keeps Move and Delete together under More when Move applies (%s)", async (action) => {
    handlers.canMove = true;
    await openMenu(memoOf());
    expect(menuItemLabels()).toEqual(["common.open", "common.edit", "common.pin", "common.archive", "common.copy", "common.more"]);

    fireEvent.click(screen.getByRole("menuitem", { name: "common.more" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: action === "move" ? "memo.move.title" : "common.delete" }));
    if (action === "move") expect(await screen.findByRole("dialog", { name: "Move to Space" })).toBeInTheDocument();
    else expect(handlers.handleDeleteMemoClick).toHaveBeenCalledOnce();
  });

  it("offers Unpin on a pinned memo", async () => {
    await openMenu(memoOf({ pinned: true }));
    fireEvent.click(screen.getByRole("menuitem", { name: "common.unpin" }));
    expect(handlers.handleTogglePinMemoBtnClick).toHaveBeenCalledOnce();
  });

  it("opens the memo through a real link that keeps the origin page", async () => {
    await openMenu(memoOf(), { parentPage: "/explore" });
    const open = screen.getByRole("menuitem", { name: "common.open" });
    expect(open.tagName).toBe("A");
    expect(open).toHaveAttribute("href", "/memos/1");

    fireEvent.click(open);
    expect(screen.getByTestId("location")).toHaveTextContent('/memos/1|{"from":"/explore"}');
  });

  it("hides Open on the memo's own page", async () => {
    handlers.isInMemoDetailPage = true;
    await openMenu(memoOf());
    expect(menuItemLabels()[0]).toBe("common.edit");
  });

  it.each([
    [true, "memo.task-actions.check-all", "handleCheckAllTaskListItemsClick"],
    [false, "memo.task-actions.uncheck-all", "handleUncheckAllTaskListItemsClick"],
  ] as const)("shows one task action after Archive (open tasks: %s)", async (hasIncompleteTasks, label, handler) => {
    await openMenu(memoOf({ property: { hasTaskList: true, hasIncompleteTasks } }));
    expect(menuItemLabels().slice(3, 5)).toEqual(["common.archive", label]);
    fireEvent.click(screen.getByRole("menuitem", { name: label }));
    expect(handlers[handler]).toHaveBeenCalledOnce();
  });

  it.each([
    ["memo.copy-link", "handleCopyLink"],
    ["memo.copy-content", "handleCopyContent"],
  ] as const)("runs %s from the Copy submenu", async (label, handler) => {
    await openMenu(memoOf());
    fireEvent.click(screen.getByRole("menuitem", { name: "common.copy" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: label }));
    expect(handlers[handler]).toHaveBeenCalledOnce();
  });

  it("offers only Restore and Delete on an archived memo", async () => {
    handlers.canMove = true;
    render(
      <MemoryRouter>
        <MemoActionMenu memo={memoOf({ state: State.ARCHIVED, property: { hasTaskList: true } })} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "common.more" }));
    await screen.findByRole("menuitem", { name: "common.restore" });
    expect(menuItemLabels()).toEqual(["common.restore", "common.delete"]);
  });

  it("gives a viewer Open and Copy only", async () => {
    await openMenu(memoOf(), { readonly: true });
    expect(menuItemLabels()).toEqual(["common.open", "common.copy"]);
  });

  it.each([
    [false, ["common.edit", "common.copy", "common.delete"]],
    [true, ["common.edit", "memo.task-actions.check-all", "common.copy", "common.delete"]],
  ] as const)("shows comment actions without Open, Pin, Archive or More (tasks: %s)", async (hasTaskList, labels) => {
    await openMenu(memoOf({ name: "memos/2", parent: "memos/1", property: { hasTaskList, hasIncompleteTasks: hasTaskList } }));
    expect(menuItemLabels()).toEqual(labels);

    fireEvent.click(screen.getByRole("menuitem", { name: "common.delete" }));
    expect(handlers.handleDeleteMemoClick).toHaveBeenCalledOnce();
    expect(handlers.confirmDeleteMemo).not.toHaveBeenCalled();
  });

  it("gives a read-only comment only Copy", async () => {
    await openMenu(memoOf({ name: "memos/2", parent: "memos/1" }), { readonly: true });
    expect(menuItemLabels()).toEqual(["common.copy"]);
  });

  it("is a quiet compact control that takes the accent fill while open", async () => {
    const memo = create(MemoSchema, { name: "memos/1", state: State.NORMAL, pinned: false });
    render(
      <MemoryRouter>
        <MemoActionMenu memo={memo} />
      </MemoryRouter>,
    );

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
