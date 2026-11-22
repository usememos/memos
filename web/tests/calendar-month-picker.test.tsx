import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { countMemosByMonth, MonthPicker, yearsWithMemos } from "@/components/CalendarView/MonthPicker";

const SEVERAL_YEARS = {
  "2021-02-03": 1,
  "2021-09-14": 2,
  "2024-12-31": 1,
  "2026-01-05": 3,
  "2026-11-02": 1,
  "2026-11-22": 2,
};

const open = (counts?: Record<string, number>, month = "2026-11") => {
  render(
    <MemoryRouter initialEntries={["/calendar/2026/11?filter=tagSearch%3Awork"]}>
      <MonthPicker month={month} monthLabel="November 2026" today="2026-11-22" counts={counts} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: /^November 2026/ }));
  return screen.getByRole("dialog");
};
const monthLink = (popup: HTMLElement, monthNumber: number) => popup.querySelector<HTMLElement>(`[data-month="${monthNumber}"]`)!;

describe("calendar month statistics", () => {
  it("folds per-day counts into months and skips empty days", () => {
    const months = countMemosByMonth({ ...SEVERAL_YEARS, "2025-03-01": 0 });
    expect(Object.fromEntries(months)).toEqual({ "2021-02": 1, "2021-09": 2, "2024-12": 1, "2026-01": 3, "2026-11": 3 });
  });
  it("lists the years that hold memos, newest first", () => {
    expect(yearsWithMemos(countMemosByMonth(SEVERAL_YEARS))).toEqual([2026, 2024, 2021]);
    expect(yearsWithMemos(countMemosByMonth({}))).toEqual([]);
  });
});

describe("calendar month picker", () => {
  it("names the heading by its month and marks it as a switcher", () => {
    open();
    const trigger = screen.getByRole("heading", { level: 1 }).querySelector("button")!;
    expect(trigger).toHaveAccessibleName(/^November 2026, /);
    expect(trigger.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
  it("stays a plain twelve-month picker while memos sit in one year", () => {
    const popup = open({ "2026-11-02": 1, "2026-01-05": 3 });
    expect(within(popup).queryByRole("group")).toBeNull();
    expect(popup).toHaveClass("w-60");
    expect(within(popup).getAllByRole("link")).toHaveLength(12);
  });
  it("draws months that hold memos in ink and lets empty ones recede", () => {
    const popup = open(SEVERAL_YEARS);
    expect(monthLink(popup, 1)).toHaveClass("text-mu-text");
    expect(monthLink(popup, 1)).toHaveAccessibleName(/^3 /);
    expect(monthLink(popup, 2)).toHaveClass("text-mu-text-secondary");
    expect(monthLink(popup, 2)).toHaveAccessibleName("February 2026");
    // The shown month is filled whether or not it holds memos, and stays a real link with the filter.
    expect(monthLink(popup, 11)).toHaveAttribute("aria-current", "page");
    expect(monthLink(popup, 11)).toHaveAttribute("href", "/calendar/2026/11?filter=tagSearch%3Awork");
  });
  it("lists the years that hold memos beside the months and switches the months in place", () => {
    const popup = open(SEVERAL_YEARS);
    const rail = within(popup).getByRole("group");
    expect(
      within(rail)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["2026", "2024", "2021"]);
    expect(within(rail).getByRole("button", { name: "2026" })).toHaveAttribute("aria-pressed", "true");
    expect(popup).toHaveClass("w-[313px]");

    fireEvent.click(within(rail).getByRole("button", { name: "2021" }));
    expect(within(rail).getByRole("button", { name: "2021" })).toHaveAttribute("aria-pressed", "true");
    expect(monthLink(popup, 9)).toHaveAttribute("href", "/calendar/2021/09?filter=tagSearch%3Awork");
    expect(monthLink(popup, 9)).toHaveClass("text-mu-text");
    expect(monthLink(popup, 10)).toHaveClass("text-mu-text-secondary");
    // Choosing a year only changes the months in view; the popup stays open.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("still steps to a year without memos, which the rail does not adopt", () => {
    const popup = open(SEVERAL_YEARS);
    const rail = within(popup).getByRole("group");
    fireEvent.click(within(popup).getByRole("button", { name: "Previous year" }));
    expect(monthLink(popup, 6)).toHaveAttribute("href", "/calendar/2025/06?filter=tagSearch%3Awork");
    expect(within(rail).getAllByRole("button")).toHaveLength(3);
    expect(within(rail).queryByRole("button", { pressed: true })).toBeNull();
  });
  it("starts on the shown month and moves across the grid with the arrow keys", async () => {
    const popup = open(SEVERAL_YEARS);
    await waitFor(() => expect(monthLink(popup, 11)).toHaveFocus());
    expect(monthLink(popup, 11)).toHaveAttribute("tabindex", "0");
    expect(monthLink(popup, 10)).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(monthLink(popup, 11), { key: "ArrowLeft" });
    expect(monthLink(popup, 10)).toHaveFocus();
    fireEvent.keyDown(monthLink(popup, 10), { key: "ArrowUp" });
    expect(monthLink(popup, 7)).toHaveFocus();
    fireEvent.keyDown(monthLink(popup, 7), { key: "Home" });
    expect(monthLink(popup, 1)).toHaveFocus();
    // The grid has an edge: there is no month before January to move to.
    fireEvent.keyDown(monthLink(popup, 1), { key: "ArrowLeft" });
    expect(monthLink(popup, 1)).toHaveFocus();
  });
  it("moves between years in the rail with the arrow keys from a single tab stop", () => {
    const popup = open(SEVERAL_YEARS);
    const years = within(within(popup).getByRole("group")).getAllByRole("button");
    expect(years.map((button) => button.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
    years[0].focus();
    fireEvent.keyDown(years[0], { key: "ArrowDown" });
    expect(years[1]).toHaveFocus();
    fireEvent.keyDown(years[1], { key: "End" });
    expect(years[2]).toHaveFocus();
  });
});
