import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SIDEBAR_ROW_BOX_CLASSES } from "@/components/AppSidebar/SidebarRow";
import { MonthNavigator } from "@/components/StatisticsView/MonthNavigator";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "en" }, t: (key: string) => key }),
}));

describe("MonthNavigator", () => {
  it("keeps month and year actions around the displayed month", () => {
    const onMonthChange = vi.fn();
    render(<MonthNavigator visibleMonth="2026-08" onMonthChange={onMonthChange} />);

    const heading = screen.getByRole("heading", { name: "August 2026", level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading.closest("header")).toHaveClass(...SIDEBAR_ROW_BOX_CLASSES.split(" "));
    expect(screen.queryByRole("button", { name: "Select month" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.previous-month" }));
    expect(onMonthChange).toHaveBeenCalledWith("2026-07");

    fireEvent.click(screen.getByRole("button", { name: "common.next-month" }));
    expect(onMonthChange).toHaveBeenCalledWith("2026-09");

    fireEvent.click(screen.getByRole("button", { name: "calendar.previous-year" }));
    expect(onMonthChange).toHaveBeenCalledWith("2025-08");

    fireEvent.click(screen.getByRole("button", { name: "calendar.next-year" }));
    expect(onMonthChange).toHaveBeenCalledWith("2027-08");
  });

  it("preserves December and January across year boundaries", () => {
    const onMonthChange = vi.fn();
    const { rerender } = render(<MonthNavigator visibleMonth="2026-12" onMonthChange={onMonthChange} />);

    fireEvent.click(screen.getByRole("button", { name: "calendar.previous-year" }));
    expect(onMonthChange).toHaveBeenLastCalledWith("2025-12");
    fireEvent.click(screen.getByRole("button", { name: "calendar.next-year" }));
    expect(onMonthChange).toHaveBeenLastCalledWith("2027-12");

    rerender(<MonthNavigator visibleMonth="2027-01" onMonthChange={onMonthChange} />);
    fireEvent.click(screen.getByRole("button", { name: "calendar.previous-year" }));
    expect(onMonthChange).toHaveBeenLastCalledWith("2026-01");
    fireEvent.click(screen.getByRole("button", { name: "calendar.next-year" }));
    expect(onMonthChange).toHaveBeenLastCalledWith("2028-01");
  });
});
