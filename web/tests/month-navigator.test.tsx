import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SIDEBAR_ROW_BOX_CLASSES } from "@/components/AppSidebar/SidebarRow";
import { MonthNavigator } from "@/components/StatisticsView/MonthNavigator";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "en" }, t: (key: string) => key }),
}));

describe("MonthNavigator", () => {
  it("keeps only previous and next month actions", () => {
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
  });
});
