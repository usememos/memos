import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarCell } from "@/components/ActivityCalendar/CalendarCell";
import type { CalendarDayCell } from "@/components/ActivityCalendar/types";

const makeDay = (overrides: Partial<CalendarDayCell> = {}): CalendarDayCell => ({
  date: "2025-05-01",
  label: "1",
  count: 0,
  isCurrentMonth: true,
  isToday: false,
  isSelected: false,
  ...overrides,
});

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
    expect(button).toHaveClass("bg-transparent");
  });

  it("still renders a populated in-month day as interactive", () => {
    const onClick = vi.fn();
    render(<CalendarCell day={makeDay({ count: 3 })} maxCount={5} tooltipText="May 1, 2025" onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: /May 1, 2025/ }));
    expect(onClick).toHaveBeenCalledWith("2025-05-01");
  });

  it("marks today with a dot without changing the numeral weight", () => {
    render(<CalendarCell day={makeDay({ isToday: true })} maxCount={5} tooltipText="May 1, 2025" onClick={() => {}} />);

    const button = screen.getByRole("button", { name: /May 1, 2025/ });
    expect(button).not.toHaveClass("font-semibold", "font-bold");
    expect(button.querySelector('[aria-hidden="true"]')).toHaveClass("rounded-full");
  });

  it("uses an inset ring for selection without changing the numeral weight", () => {
    render(<CalendarCell day={makeDay({ isSelected: true })} maxCount={5} tooltipText="May 1, 2025" onClick={() => {}} />);

    const button = screen.getByRole("button", { name: /selected/ });
    expect(button).toHaveClass("ring-2", "ring-inset");
    expect(button).not.toHaveClass("font-semibold", "font-bold");
  });

  it("does not render out-of-month days as interactive (no role=button)", () => {
    render(
      <CalendarCell day={makeDay({ isCurrentMonth: false })} maxCount={5} tooltipText="May 1, 2025" onClick={() => {}} />,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });
});
