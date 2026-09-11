import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CalendarDayCell, layoutForCellSize } from "@/components/CalendarView/CalendarDayCell";
import type { CalendarDaySummary } from "@/components/CalendarView/dayModel";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const summary: CalendarDaySummary = {
  memos: [create(MemoSchema), create(MemoSchema)],
  excerpt: { memoName: "memos/a", text: "A memorable afternoon", isCode: false },
  images: [{ memoName: "memos/b", thumbnailUrl: "/photo.jpg" }],
};
interface CellOptions {
  width?: number;
  height?: number;
  isSelected?: boolean;
  isToday?: boolean;
}
const cell = (value?: CalendarDaySummary, { width = 170, height = 170, isSelected = true, isToday = true }: CellOptions = {}) =>
  render(
    <MemoryRouter initialEntries={["/spaces/work/calendar/2026/08?filter=test"]}>
      <CalendarDayCell
        day={{ date: "2026-08-07", label: 7, count: 0, isCurrentMonth: true, isToday, isSelected }}
        summary={value}
        maxCount={4}
        layout={layoutForCellSize(width, height)}
        pending={false}
        timeBasis="create_time"
        tabIndex={0}
        isLastColumn={false}
        isLastRow={false}
      />
    </MemoryRouter>,
  );

describe("calendar daily snapshot cell", () => {
  it("keeps the count out of the cell text and in one day link with Space and filters", () => {
    cell(summary);
    const link = screen.getByRole("link");
    expect(screen.queryByText("2")).toBeNull();
    // Today's badge is a 22px rounded square that starts on the text axis, not a centred disc.
    expect(screen.getByText("7")).toHaveClass("text-primary-foreground", "bg-primary", "rounded-md", "h-[22px]", "text-ui");
    expect(screen.getByText("7")).not.toHaveClass("size-6", "before:rounded-full");
    expect(link).toHaveAccessibleName("2 memos in 2026-08-07");
    expect(link).toHaveAttribute("href", "/spaces/work/calendar/2026/08/07?filter=test");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("keeps empty days clickable without a zero count or image space", () => {
    cell();
    expect(screen.getByRole("link")).toHaveAttribute("tabindex", "0");
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByText(/memos/)).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });
  it("tints the background by the day's share of the busiest day, like a heatmap", () => {
    cell(summary, { isSelected: false });
    // Two of a max of four memos is the second of four levels.
    expect(screen.getByRole("link")).toHaveClass("bg-primary/16");
    expect(screen.getByRole("link")).not.toHaveClass("bg-card", "bg-accent");
  });
  it("keeps the heat tint under the open day and marks it with a quiet badge on the numeral", () => {
    cell(summary, { isToday: false });
    expect(screen.getByRole("link")).toHaveClass("bg-primary/16");
    expect(screen.getByRole("link")).not.toHaveClass("bg-accent");
    expect(screen.getByText("7")).toHaveClass("font-medium", "bg-foreground/10", "text-foreground", "rounded-md");
    expect(screen.getByText("7").parentElement).not.toHaveClass("bg-foreground/10");
  });
  it("marks today with the solid primary badge and no weight change", () => {
    cell(summary, { isSelected: false });
    expect(screen.getByText("7")).toHaveClass("bg-primary", "text-primary-foreground", "font-normal");
    expect(screen.getByText("7").parentElement).not.toHaveClass("bg-foreground/10");
  });
  it("nests today's badge in a grey halo when today is also the open day", () => {
    cell(summary);
    expect(screen.getByText("7")).toHaveClass("bg-primary", "text-primary-foreground", "font-medium");
    expect(screen.getByText("7").parentElement).toHaveClass("bg-foreground/10", "p-[3px]", "-m-[3px]");
  });
  it("removes failed photos while retaining the excerpt", () => {
    cell(summary);
    fireEvent.error(document.querySelector("img")!);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("A memorable afternoon")).toBeInTheDocument();
  });
  it("keeps a thumbnail under a clamped excerpt in the 117px cell that previously hid it", () => {
    cell(summary, { width: 106, height: 117 });
    expect(document.querySelector("img")).toHaveAttribute("src", "/photo.jpg");
    expect(document.querySelector("img")).toHaveClass("size-9", "rounded-md");
    expect(screen.getByText("A memorable afternoon")).toHaveStyle({ WebkitLineClamp: "1" });
    expect(screen.getByText("A memorable afternoon")).toHaveClass("text-ui", "leading-[18px]");
  });
  it("keeps the image instead of text when both cannot fit in a short cell", () => {
    cell(summary, { width: 106, height: 97 });
    expect(document.querySelector("img")).toHaveAttribute("src", "/photo.jpg");
    expect(screen.queryByText("A memorable afternoon")).toBeNull();
    fireEvent.error(document.querySelector("img")!);
    expect(screen.getByText("A memorable afternoon")).toBeInTheDocument();
  });
  it("keeps image-only days visible in short cells", () => {
    cell({ ...summary, excerpt: undefined }, { width: 106, height: 88 });
    expect(document.querySelector("img")).toHaveAttribute("src", "/photo.jpg");
  });
  it("shows only the tinted date when narrow", () => {
    cell(summary, { width: 72, isSelected: false });
    expect(screen.getByRole("link")).toHaveClass("bg-primary/16");
    expect(screen.queryByText("A memorable afternoon")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });
});
