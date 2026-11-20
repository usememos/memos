import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CalendarHeader } from "@/components/CalendarView/CalendarHeader";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "en" }, t: (key: string) => key }),
}));

describe("CalendarHeader year navigation", () => {
  it("preserves the Space and filter while changing year and closing the selected day", () => {
    render(
      <MemoryRouter initialEntries={["/spaces/work/calendar/2026/12/31?filter=tag%3Awork"]}>
        <CalendarHeader month="2026-12" monthLabel="December 2026" today="2026-11-10" activeDate="2026-12-31" closable />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "calendar.previous-year" })).toHaveAttribute(
      "href",
      "/spaces/work/calendar/2025/12?filter=tag%3Awork",
    );
    expect(screen.getByRole("link", { name: "calendar.next-year" })).toHaveAttribute(
      "href",
      "/spaces/work/calendar/2027/12?filter=tag%3Awork",
    );
    expect(screen.getByRole("link", { name: "common.previous-month" })).toHaveAttribute(
      "href",
      "/spaces/work/calendar/2026/11?filter=tag%3Awork",
    );
    expect(screen.getByRole("link", { name: "common.next-month" })).toHaveAttribute(
      "href",
      "/spaces/work/calendar/2027/01?filter=tag%3Awork",
    );
  });

  it("keeps January when stepping backward or forward by a year", () => {
    render(
      <MemoryRouter initialEntries={["/calendar/2027/01"]}>
        <CalendarHeader month="2027-01" monthLabel="January 2027" today="2026-11-10" closable={false} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "calendar.previous-year" })).toHaveAttribute("href", "/calendar/2026/01");
    expect(screen.getByRole("link", { name: "calendar.next-year" })).toHaveAttribute("href", "/calendar/2028/01");
  });
});
