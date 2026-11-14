import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Tooltip } from "@usememos/ui";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReactionSelector from "@/components/MemoReactionListView/ReactionSelector";
import { findEmoji } from "@/lib/emoji";
import { MemoSchema } from "@/types/proto/api/memo_service_pb";

const actions = vi.hoisted(() => ({ handleReactionClick: vi.fn(), hasReacted: () => false, isPending: false, canReact: true }));
vi.mock("@/components/MemoReactionListView/hooks", () => ({ useReactionActions: () => actions }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const setup = async () => {
  render(
    <Tooltip.Provider>
      <ReactionSelector memo={create(MemoSchema, { name: "memos/1" })} />
    </Tooltip.Provider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "memo.add-reaction" }));
  const picker = within(await screen.findByRole("dialog"));
  return { picker, search: picker.getByRole("combobox"), grid: picker.getByRole("grid") };
};

const activeCell = (search: HTMLElement) => document.getElementById(search.getAttribute("aria-activedescendant") ?? "");

describe("ReactionSelector with the full emoji catalog", () => {
  beforeEach(() => {
    actions.handleReactionClick.mockReset().mockReturnValue(true);
  });

  it("renders a bounded window, reaches the last emoji by scrolling, and resets after search", async () => {
    const { picker, search, grid } = await setup();
    const options = findEmoji("");
    expect(options.length).toBeGreaterThan(3000);
    expect(picker.getAllByRole("gridcell").length).toBeLessThan(130);
    expect(grid).toHaveAttribute("aria-rowcount", String(Math.ceil(options.length / 8)));

    fireEvent.scroll(grid, { target: { scrollTop: (options.length / 8) * 34 } });
    const last = options.at(-1)!;
    expect(picker.getByRole("gridcell", { name: last.name })).toHaveTextContent(last.emoji);
    expect(picker.getAllByRole("gridcell").length).toBeLessThan(130);

    fireEvent.change(search, { target: { value: "phoenix" } });
    expect(grid.scrollTop).toBe(0);
    expect(picker.getAllByRole("gridcell")).toHaveLength(1);
    expect(picker.getByRole("gridcell", { name: "phoenix" })).toHaveTextContent("🐦‍🔥");
    fireEvent.change(search, { target: { value: "" } });
    expect(picker.getByRole("gridcell", { name: options[0].name })).toBeInTheDocument();
    expect(picker.getAllByRole("gridcell").length).toBeLessThan(130);
  });

  it("keeps keyboard navigation and selection working beyond the mounted window", async () => {
    const { search, grid } = await setup();
    fireEvent.keyDown(search, { key: "ArrowDown" });
    await waitFor(() => expect(activeCell(search)).toHaveAttribute("aria-label", findEmoji("")[0].name));
    for (let row = 0; row < 20; row++) fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "ArrowRight" });
    const option = findEmoji("")[20 * 8 + 1];
    expect(activeCell(search)).toHaveAttribute("aria-label", option.name);
    expect(grid.scrollTop).toBeGreaterThan(0);

    fireEvent.scroll(grid, { target: { scrollTop: 10000 } });
    expect(activeCell(search)).toHaveAttribute("aria-label", option.name);
    fireEvent.keyDown(search, { key: "ArrowDown" });
    const next = findEmoji("")[21 * 8 + 1];
    expect(activeCell(search)).toHaveAttribute("aria-label", next.name);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(actions.handleReactionClick).toHaveBeenCalledWith(next.emoji);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
