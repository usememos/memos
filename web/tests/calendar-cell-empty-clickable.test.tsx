import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarCell } from "@/components/ActivityCalendar/CalendarCell";
import type { CalendarDayCell } from "@/components/ActivityCalendar/types";

const makeDay = (overrides: Partial<CalendarDayCell> = {}): CalendarDayCell => ({
  date: "2025-05-01",
  label: 1,
  count: 0,
  isCurrentMonth: true,
  isToday: false,
  isSelected: false,
  ...overrides,
});

/** The button spans its column; the square chip inside it carries every visual. */
const chipOf = (button: HTMLElement) => button.firstElementChild as HTMLElement;

describe("CalendarCell empty-day clickability", () => {
  it("fires onClick for an in-month day with count=0", () => {
    const onClick = vi.fn();
    render(<CalendarCell day={makeDay()} maxCount={5} tooltipText="May 1, 2025" onClick={onClick} />);

    const button = screen.getByRole("button", { name: /May 1, 2025/ });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledWith("2025-05-01");
  });

  it("renders an empty in-month day as interactive (tabIndex 0, not aria-disabled)", () => {
    render(<CalendarCell day={makeDay()} maxCount={5} tooltipText="May 1, 2025" onClick={() => {}} />);

    const button = screen.getByRole("button", { name: /May 1, 2025/ });
    expect(button).toHaveAttribute("tabindex", "0");
    expect(button).toHaveAttribute("aria-disabled", "false");
    expect(button).not.toHaveAttribute("data-slot", "tooltip-trigger");
    expect(chipOf(button)).toHaveClass("bg-transparent");
  });

  it("still renders a populated in-month day as interactive", () => {
    const onClick = vi.fn();
    render(<CalendarCell day={makeDay({ count: 3 })} maxCount={5} tooltipText="May 1, 2025" onClick={onClick} />);

    const button = screen.getByRole("button", { name: /May 1, 2025/ });
    expect(button).toHaveAttribute("data-slot", "tooltip-trigger");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledWith("2025-05-01");
  });

  it("marks today with a dot without changing the numeral weight", () => {
    render(<CalendarCell day={makeDay({ isToday: true })} maxCount={5} tooltipText="May 1, 2025" onClick={() => {}} />);

    const button = screen.getByRole("button", { name: /May 1, 2025/ });
    expect(button).not.toHaveClass("font-semibold", "font-bold");
    expect(button.querySelector('[aria-hidden="true"]')).toHaveClass("rounded-full");
  });

  it("fills a selected day with the accent like a checked filter row, keeping the numeral weight", () => {
    render(<CalendarCell day={makeDay({ isSelected: true })} maxCount={5} tooltipText="May 1, 2025" onClick={() => {}} />);

    const button = screen.getByRole("button", { name: /selected/ });
    expect(chipOf(button)).toHaveClass("bg-primary", "text-primary-foreground", "font-medium");
    expect(chipOf(button)).not.toHaveClass("ring-2", "ring-inset");
    expect(chipOf(button)).not.toHaveClass("font-semibold", "font-bold");
  });

  it("keeps the accent fill on a selected empty day under hover", () => {
    render(<CalendarCell day={makeDay({ isSelected: true })} maxCount={5} tooltipText="May 1, 2025" onClick={() => {}} />);

    const chip = chipOf(screen.getByRole("button", { name: /selected/ }));
    // The empty-cell hover tint would replace bg-primary on hover and strand the light numeral.
    expect(chip).not.toHaveClass("group-hover/day:bg-muted/40", "bg-transparent");
    expect(chip).toHaveClass("bg-primary");
  });

  it("caps the chip so a wider container buys hit area, not calendar height", () => {
    render(<CalendarCell day={makeDay()} maxCount={5} tooltipText="May 1, 2025" onClick={() => {}} />);

    const button = screen.getByRole("button", { name: /May 1, 2025/ });
    // The square lives on the capped chip. Putting it back on the button would make row
    // height track the column width again, which is what made a widened rail so tall.
    expect(button).not.toHaveClass("aspect-square");
    expect(chipOf(button)).toHaveClass("aspect-square", "max-w-[30px]");
  });

  it("does not render out-of-month days as interactive (no role=button)", () => {
    render(<CalendarCell day={makeDay({ isCurrentMonth: false })} maxCount={5} tooltipText="May 1, 2025" onClick={() => {}} />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
