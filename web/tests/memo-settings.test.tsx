import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState, EditorProvider, useEditorContext, useEditorSelector } from "@/components/MemoEditor/state";
import { EditorToolbar } from "@/components/MemoEditor/Toolbar/EditorToolbar";
import MemoSettings from "@/components/MemoEditor/Toolbar/MemoSettings";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

const spacesQuery = vi.hoisted(() => ({
  data: [
    { name: "spaces/work", title: "Work", icon: { value: { case: "emoji", value: "💎" } } },
    { name: "spaces/reading", title: "Reading" },
  ],
  isPending: false,
  isError: false,
  refetch: vi.fn(),
}));
vi.mock("@/components/MemoEditor/Toolbar/InsertMenu", () => ({ default: () => null }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/test" }) }));
vi.mock("@/hooks/useSpaceQueries", () => ({ useSpaces: () => spacesQuery }));

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

// Base UI menus reach for layout/pointer APIs jsdom doesn't implement.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const openMenu = async (value: Visibility, onChange = vi.fn(), space?: string) => {
  render(<MemoSettings value={value} space={space} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button"));
  await screen.findByRole("dialog");
  return onChange;
};

beforeEach(() => {
  spacesQuery.isPending = false;
  spacesQuery.isError = false;
  spacesQuery.data[0].title = "Work";
});

describe("MemoSettings", () => {
  it("omits the Space audience when the edited memo has no Space placement", async () => {
    await openMenu(Visibility.PRIVATE);

    expect(screen.getAllByRole("radio").map((item) => item.textContent)).toEqual([
      "memo.visibility.privatememo.visibility.private-description",
      "memo.visibility.protectedmemo.visibility.protected-description",
      "memo.visibility.publicmemo.visibility.public-description",
    ]);
  });

  it("offers the Space audience with its own description when the edited memo belongs to a Space", async () => {
    await openMenu(Visibility.PRIVATE, vi.fn(), "spaces/product");

    const spaceItem = screen.getByRole("radio", { name: /memo\.visibility\.space/ });
    expect(spaceItem).toHaveTextContent("memo.visibility.space-description");
  });

  it("names the current Space audience even when placement is unavailable", () => {
    render(<MemoSettings value={Visibility.SPACE} onChange={vi.fn()} />);

    expect(screen.getByRole("button")).toHaveTextContent("memo.visibility.space");
  });

  it("keeps the current Space audience selectable when placement is unavailable", async () => {
    await openMenu(Visibility.SPACE);

    expect(screen.getByRole("radio", { name: /memo\.visibility\.space/ })).toBeInTheDocument();
  });

  it("reports the picked audience", async () => {
    const onChange = await openMenu(Visibility.PRIVATE);

    fireEvent.click(screen.getByRole("radio", { name: /memo\.visibility\.public/ }));

    expect(onChange).toHaveBeenCalledWith(Visibility.PUBLIC);
  });
});

describe("composer Space selection", () => {
  it("keeps Space choices behind a select in the existing settings popover", async () => {
    const onSpaceChange = vi.fn();
    const onChange = vi.fn();
    render(<MemoSettings value={Visibility.PRIVATE} onChange={onChange} onSpaceChange={onSpaceChange} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button")).not.toHaveTextContent("space.no-space");
    fireEvent.click(screen.getByRole("button"));
    const select = await screen.findByRole("combobox", { name: "space.current" });
    expect(select).toHaveTextContent("space.no-space");
    expect(select.querySelector(".bg-sidebar-accent")).toBeNull();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    fireEvent.click(select);
    const work = await screen.findByRole("option", { name: "Work" });
    expect(work.querySelector(".bg-sidebar-accent")).not.toBeNull();
    fireEvent.pointerDown(work, { pointerType: "mouse" });
    fireEvent.click(work);
    expect(onSpaceChange).toHaveBeenCalledWith("spaces/work");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("clears the destination and retains full long titles for the selected value and options", async () => {
    const onSpaceChange = vi.fn();
    const longTitle = "Work " + "a very long Space title ".repeat(15);
    spacesQuery.data[0].title = longTitle;
    const { rerender } = render(
      <MemoSettings value={Visibility.PRIVATE} space="spaces/work" onChange={vi.fn()} onSpaceChange={onSpaceChange} />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("title", `${longTitle} · memo.visibility.private`);
    expect(screen.getByRole("button")).toHaveTextContent("💎");
    expect(screen.getByRole("button").querySelector(".bg-sidebar-accent")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    const select = await screen.findByRole("combobox");
    expect(select).toHaveAttribute("title", longTitle);
    expect(select.querySelector(".bg-sidebar-accent")).not.toBeNull();
    fireEvent.click(select);
    expect(await screen.findByRole("option", { name: /Work a very long Space title/ })).toHaveAttribute("title", longTitle);
    const noSpace = screen.getByRole("option", { name: "space.no-space" });
    fireEvent.pointerDown(noSpace, { pointerType: "mouse" });
    fireEvent.click(noSpace);
    expect(onSpaceChange).toHaveBeenCalledWith(undefined);
    rerender(<MemoSettings value={Visibility.PRIVATE} onChange={vi.fn()} onSpaceChange={onSpaceChange} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("space.no-space");
    spacesQuery.data[0].title = "Work";
  });

  it("omits the destination section and summary for a fixed Space", async () => {
    await openMenu(Visibility.PRIVATE, vi.fn(), "spaces/work");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).not.toHaveTextContent("Work");
  });

  it("shows loading and retry states without losing visibility choices", async () => {
    spacesQuery.isPending = true;
    const props = { value: Visibility.PRIVATE, onChange: vi.fn(), onSpaceChange: vi.fn() };
    const { rerender } = render(<MemoSettings {...props} />);
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("status")).toHaveTextContent("space.loading");
    spacesQuery.isPending = false;
    spacesQuery.isError = true;
    rerender(<MemoSettings {...props} />);
    expect(screen.getByRole("alert")).toHaveTextContent("space.load-error");
    fireEvent.click(screen.getByRole("button", { name: "search.retry" }));
    expect(spacesQuery.refetch).toHaveBeenCalled();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });
});

it("clearing Space visibility falls back to Private without discarding content", async () => {
  let getState: ReturnType<typeof useEditorContext>["getState"];
  function Toolbar() {
    getState = useEditorContext().getState;
    const space = useEditorSelector((state) => state.metadata.space);
    return <EditorToolbar space={space} canChooseSpace onSave={vi.fn()} onAudioRecorderClick={vi.fn()} onInsertImages={vi.fn()} />;
  }
  const initial = createInitialState();
  initial.content = "Keep this draft";
  initial.metadata = { ...initial.metadata, space: "spaces/work", visibility: Visibility.SPACE };
  render(
    <EditorProvider initialEditorState={initial}>
      <Toolbar />
    </EditorProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Work · memo.visibility.space" }));
  fireEvent.click(await screen.findByRole("combobox"));
  const noSpace = await screen.findByRole("option", { name: "space.no-space" });
  fireEvent.pointerDown(noSpace, { pointerType: "mouse" });
  fireEvent.click(noSpace);
  expect(getState!().metadata.space).toBeUndefined();
  expect(getState!().metadata.visibility).toBe(Visibility.PRIVATE);
  expect(getState!().content).toBe("Keep this draft");
  expect(screen.queryByRole("radio", { name: /memo.visibility.space/ })).not.toBeInTheDocument();
});
