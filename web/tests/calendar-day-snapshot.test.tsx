import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CalendarDayCell, layoutForCellSize } from "@/components/CalendarView/CalendarDayCell";
import type { CalendarDaySummary } from "@/components/CalendarView/dayModel";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const users: Record<string, { name: string; username: string; displayName: string; avatarUrl: string }> = {
  "users/bob": { name: "users/bob", username: "bob", displayName: "Bob Martin", avatarUrl: "/bob.png" },
  "users/carol": { name: "users/carol", username: "carol", displayName: "Carol Diaz", avatarUrl: "/carol.png" },
  "users/dan": { name: "users/dan", username: "dan", displayName: "Dan Okafor", avatarUrl: "/dan.png" },
};
vi.mock("@/components/MemoContent/MentionResolutionContext", () => ({
  useResolvedUser: (name: string, options?: { enabled?: boolean }) => (options?.enabled ? users[name] : undefined),
  useResolvedUsersByNames: (names: string[]) => new Map(names.map((name) => [name, users[name]])),
}));

const summary: CalendarDaySummary = {
  memos: [create(MemoSchema), create(MemoSchema)],
  excerpt: { memoName: "memos/a", creator: "users/bob", text: "A memorable afternoon", isCode: false },
  creators: ["users/bob", "users/carol", "users/dan"],
  images: [{ memoName: "memos/b", thumbnailUrl: "/photo.jpg" }],
};
const textOnly: CalendarDaySummary = { ...summary, images: [] };
interface CellOptions {
  width?: number;
  height?: number;
  isSelected?: boolean;
  isToday?: boolean;
  isCurrentMonth?: boolean;
  showAuthor?: boolean;
}
const cell = (
  value?: CalendarDaySummary,
  { width = 170, height = 170, isSelected = true, isToday = true, isCurrentMonth = true, showAuthor = false }: CellOptions = {},
) =>
  render(
    <MemoryRouter initialEntries={["/spaces/work/calendar/2026/08?filter=test"]}>
      <CalendarDayCell
        day={{ date: "2026-08-07", label: 7, count: 0, isCurrentMonth, isToday, isSelected }}
        summary={value}
        maxCount={4}
        layout={layoutForCellSize(width, height)}
        pending={false}
        timeBasis="create_time"
        showAuthor={showAuthor}
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
  it("keeps a slim preview with tighter padding under preview width", () => {
    cell(summary, { width: 92, height: 140, isSelected: false });
    expect(screen.getByRole("link")).toHaveClass("sm:px-2");
    expect(screen.getByText("A memorable afternoon")).toHaveStyle({ WebkitLineClamp: "1" });
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });
  it("trades the preview for a mark on the tinted date when very narrow", () => {
    cell(summary, { width: 56, isSelected: false });
    expect(screen.getByRole("link")).toHaveClass("bg-primary/16");
    expect(screen.queryByText("A memorable afternoon")).toBeNull();
    expect(document.querySelectorAll("img")).toHaveLength(1);
    expect(document.querySelector("img")).toHaveClass("size-4");
  });
  it("leads the excerpt with its author's avatar when several creators share the grid", () => {
    cell(summary, { showAuthor: true });
    const excerpt = screen.getByText("A memorable afternoon");
    const avatar = excerpt.firstElementChild;
    // Inside the clamped line, so it sits on the first line and never takes a line of its own.
    expect(avatar).toHaveClass("inline-flex", "size-3.5");
    expect(avatar?.querySelector("img")).toHaveAttribute("src", "/bob.png");
    expect(excerpt).toHaveTextContent(/^A memorable afternoon$/);
  });
  it("leaves the excerpt unattributed in a single creator's scope", () => {
    cell(summary);
    expect(screen.getByText("A memorable afternoon").firstElementChild).toBeNull();
    expect(document.querySelector('img[src="/bob.png"]')).toBeNull();
  });
  it("shows no avatar when the cell is too narrow for an excerpt", () => {
    cell(summary, { width: 56, showAuthor: true });
    expect(document.querySelector('img[src="/bob.png"]')).toBeNull();
  });

  describe("phone mark", () => {
    // The compact phone grid: a 49px column with no room for preview rows.
    const phone = { width: 49, height: 0 };
    const avatars = () => [...document.querySelectorAll("img")].map((image) => image.getAttribute("src"));

    it("shows the day's first photo as a small thumbnail under the date", () => {
      cell(summary, { ...phone, showAuthor: true });
      expect(avatars()).toEqual(["/photo.jpg"]);
      expect(document.querySelector("img")).toHaveClass("size-4");
      expect(screen.queryByText("A memorable afternoon")).toBeNull();
    });
    it("names up to two authors when several creators share the grid and there is no photo", () => {
      cell(textOnly, { ...phone, showAuthor: true });
      expect(avatars()).toEqual(["/bob.png", "/carol.png"]);
    });
    it("falls back from a photo that fails to load to the next mark", () => {
      cell(summary, { ...phone, showAuthor: true });
      fireEvent.error(document.querySelector("img")!);
      expect(avatars()).toEqual(["/bob.png", "/carol.png"]);
    });
    it("draws written lines in a single creator's scope, never the text itself", () => {
      cell(textOnly, phone);
      expect(document.querySelector("img")).toBeNull();
      expect(screen.getByRole("link").querySelectorAll(".rounded-full.bg-current")).toHaveLength(2);
      expect(screen.getByRole("link")).toHaveTextContent(/^7$/);
    });
    it("marks nothing on empty days or days outside the month", () => {
      cell(undefined, phone);
      expect(screen.getByRole("link").querySelector(".h-4")).toBeNull();
      cell(summary, { ...phone, isCurrentMonth: false });
      expect(document.querySelectorAll("img")).toHaveLength(0);
    });
    it("leaves cells with room for a preview unmarked", () => {
      cell(summary, { showAuthor: true });
      expect(avatars()).toEqual(["/bob.png", "/photo.jpg"]);
      expect(document.querySelector("img.size-4")).toBeNull();
    });
  });
});
