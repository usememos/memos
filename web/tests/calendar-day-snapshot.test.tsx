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
const cell = (value?: CalendarDaySummary, width = 170, height = 170) =>
  render(
    <MemoryRouter initialEntries={["/spaces/work/calendar/2026/08?filter=test"]}>
      <CalendarDayCell
        day={{ date: "2026-08-07", label: 7, count: 0, isCurrentMonth: true, isToday: true, isSelected: true }}
        summary={value}
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
  it("separates the count from the date and keeps one day link with Space and filters", () => {
    cell(summary);
    const link = screen.getByRole("link");
    expect(screen.getByText("2")).not.toHaveClass("rounded-full", "bg-primary");
    expect(screen.getByText("7")).toHaveClass("text-primary-foreground", "size-6");
    expect(screen.getByText("2")).toHaveClass("font-normal", "text-muted-foreground");
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
  it("removes failed photos while retaining the excerpt and total count", () => {
    cell(summary);
    fireEvent.error(document.querySelector("img")!);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("A memorable afternoon")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
  it("keeps a thumbnail beside a clamped excerpt in the 117px cell that previously hid it", () => {
    cell(summary, 106, 117);
    expect(document.querySelector("img")).toHaveAttribute("src", "/photo.jpg");
    expect(screen.getByText("A memorable afternoon")).toHaveStyle({ WebkitLineClamp: "1" });
  });
  it("keeps the image instead of text when both cannot fit in a short cell", () => {
    cell(summary, 106, 97);
    expect(document.querySelector("img")).toHaveAttribute("src", "/photo.jpg");
    expect(screen.queryByText("A memorable afternoon")).toBeNull();
    fireEvent.error(document.querySelector("img")!);
    expect(screen.getByText("A memorable afternoon")).toBeInTheDocument();
  });
  it("keeps image-only days visible in short cells", () => {
    cell({ ...summary, excerpt: undefined }, 106, 88);
    expect(document.querySelector("img")).toHaveAttribute("src", "/photo.jpg");
  });
  it("shows only the date and count when narrow", () => {
    cell(summary, 72);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("A memorable afternoon")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });
});
