import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MonthNavigator } from "@/components/StatisticsView/MonthNavigator";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "en" }, t: (key: string) => key }),
}));

describe("MonthNavigator", () => {
  it("keeps only previous and next month actions", () => {
    const onMonthChange = vi.fn();
    render(<MonthNavigator visibleMonth="2026-08" onMonthChange={onMonthChange} />);

    expect(screen.getByRole("heading", { name: "August 2026" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select month" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.previous-month" }));
    expect(onMonthChange).toHaveBeenCalledWith("2026-07");

    fireEvent.click(screen.getByRole("button", { name: "common.next-month" }));
    expect(onMonthChange).toHaveBeenCalledWith("2026-09");
  });
});
