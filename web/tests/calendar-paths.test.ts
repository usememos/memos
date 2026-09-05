import { describe, expect, it } from "vitest";
import { buildCalendarPath, parseCalendarParams } from "@/components/CalendarView";

describe("calendar route params", () => {
  it("resolves a month and pads single-digit segments", () => {
    expect(parseCalendarParams({ year: "2026", month: "8" })).toEqual({ month: "2026-08" });
    expect(parseCalendarParams({ year: "2026", month: "08" })).toEqual({ month: "2026-08" });
  });

  it("resolves a day inside the month", () => {
    expect(parseCalendarParams({ year: "2026", month: "08", day: "2" })).toEqual({ month: "2026-08", date: "2026-08-02" });
  });

  it.each([
    [{}],
    [{ year: "2026" }],
    [{ year: "26", month: "08" }],
    [{ year: "2026", month: "13" }],
    [{ year: "2026", month: "0" }],
    [{ year: "2026", month: "02", day: "30" }],
    [{ year: "2026", month: "08", day: "x" }],
  ])("rejects %j", (params) => {
    expect(parseCalendarParams(params)).toBeUndefined();
  });

  it("builds canonical month and day paths", () => {
    expect(buildCalendarPath("2026-08")).toBe("/calendar/2026/08");
    expect(buildCalendarPath("2026-08", "2026-08-02")).toBe("/calendar/2026/08/02");
  });

  it("round-trips through the router params", () => {
    const [, , year, month, day] = buildCalendarPath("2026-08", "2026-08-17").split("/");
    expect(parseCalendarParams({ year, month, day })).toEqual({ month: "2026-08", date: "2026-08-17" });
  });
});
