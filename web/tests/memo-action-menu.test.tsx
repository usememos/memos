import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoActionMenu from "@/components/MemoActionMenu";
import { State } from "@/types/proto/api/common_pb";
import { type Memo, MemoSchema } from "@/types/proto/api/memo_service_pb";

const handlers = vi.hoisted(() => ({
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
    handlers.isInMemoDetailPage = false;
  });

  it("groups an owner's memo actions by what they do to the card and puts Delete last, with no Move entry", async () => {
    await openMenu(memoOf({ space: "spaces/work" }));
    expect(menuItemLabels()).toEqual(["common.edit", "common.pin", "common.archive", "common.open", "common.copy", "common.delete"]);
    const separators = screen.getAllByRole("separator");
    expect(separators[separators.length - 1].nextElementSibling).toBe(screen.getByRole("menuitem", { name: "common.delete" }));
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
    expect(menuItemLabels()).toEqual(["common.edit", "common.pin", "common.archive", "common.copy", "common.delete"]);
  });

  it.each([
    [true, "memo.task-actions.check-all", "handleCheckAllTaskListItemsClick"],
    [false, "memo.task-actions.uncheck-all", "handleUncheckAllTaskListItemsClick"],
  ] as const)("shows one task action right after Edit (open tasks: %s)", async (hasIncompleteTasks, label, handler) => {
    await openMenu(memoOf({ property: { hasTaskList: true, hasIncompleteTasks } }));
    expect(menuItemLabels().slice(0, 3)).toEqual(["common.edit", label, "common.pin"]);
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

  it("opens the card's own actions on secondary click and returns focus to the card on Escape", async () => {
    const cardRef = createRef<HTMLElement>();
    render(
      <MemoryRouter>
        <article ref={cardRef} tabIndex={-1}>
          <MemoActionMenu memo={memoOf()} readonly cardRef={cardRef} />
          <p>Memo body</p>
          <a href="/explore">Explore</a>
        </article>
      </MemoryRouter>,
    );
    const body = screen.getByText("Memo body");
    const link = screen.getByRole("link");
    fireEvent.pointerDown(link, { pointerType: "mouse", button: 2 });
    expect(fireEvent.contextMenu(link)).toBe(true);
    fireEvent.pointerDown(body, { pointerType: "touch", button: 0 });
    expect(fireEvent.contextMenu(body)).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.pointerDown(body, { pointerType: "mouse", button: 2 });
    expect(fireEvent.contextMenu(body, { button: 2, clientX: 90, clientY: 120 })).toBe(false);
    const menu = await screen.findByRole("menu");
    expect(menuItemLabels()).toEqual(["common.open", "common.copy"]);
    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(cardRef.current).toHaveFocus();
  });

  it("preserves the browser menu over selected text and opens the memo menu beside the selection", async () => {
    const cardRef = createRef<HTMLElement>();
    render(
      <MemoryRouter>
        <article ref={cardRef}>
          <MemoActionMenu memo={memoOf()} cardRef={cardRef} />
          <p>First line</p>
          <p>Second line</p>
        </article>
      </MemoryRouter>,
    );
    const first = screen.getByText("First line");
    const range = document.createRange();
    range.selectNodeContents(first);
    Object.assign(range, { getClientRects: () => [new DOMRect(10, 10, 80, 20)] });
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    expect(document.getSelection()?.toString()).toBe("First line");

    fireEvent.pointerDown(first, { button: 2, pointerType: "mouse", clientX: 15, clientY: 18 });
    expect(fireEvent.contextMenu(first)).toBe(true);
    expect(document.getSelection()?.toString()).toBe("First line");
    const second = screen.getByText("Second line");
    fireEvent.pointerDown(second, { button: 0, ctrlKey: true, pointerType: "mouse", clientX: 15, clientY: 48 });
    expect(fireEvent.contextMenu(second, { ctrlKey: true, clientX: 15, clientY: 48 })).toBe(false);
    expect(await screen.findByRole("menuitem", { name: "common.edit" })).toBeVisible();
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
    expect(trigger).toHaveClass("mu-button", "mu-button-ghost", "mu-button-icon", "mu-s-sm");
    expect(trigger.className).not.toMatch(/ring-/);
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger.querySelector(".lucide-ellipsis")).not.toBeNull();

    fireEvent.click(trigger);

    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
    expect(trigger).toHaveAttribute("data-popup-open");
    expect(await screen.findByRole("menuitem", { name: "common.pin" })).toBeInTheDocument();
  });
});
