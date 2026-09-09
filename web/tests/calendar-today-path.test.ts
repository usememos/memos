import { describe, expect, it } from "vitest";
import { getTodayPath } from "@/components/CalendarView/CalendarHeader";

describe("calendar Today action", () => {
  const today = "2026-09-05";

  it("returns to the current month from another month without opening a day", () => {
    expect(getTodayPath("2026-07", undefined, today, true)).toBe("/calendar/2026/09");
    expect(getTodayPath("2026-07", "2026-07-16", today, true)).toBe("/calendar/2026/09");
    expect(getTodayPath("2026-07", "2026-07-01", today, false)).toBe("/calendar/2026/09");
  });

  it("opens today when the current month is already shown", () => {
    expect(getTodayPath("2026-09", undefined, today, true)).toBe("/calendar/2026/09/05");
    expect(getTodayPath("2026-09", "2026-09-04", today, true)).toBe("/calendar/2026/09/05");
    expect(getTodayPath("2026-09", "2026-09-04", today, false)).toBe("/calendar/2026/09/05");
  });

  it("closes today's panel on a second press only where the day can be dismissed", () => {
    expect(getTodayPath("2026-09", today, today, true)).toBe("/calendar/2026/09");
    expect(getTodayPath("2026-09", today, today, false)).toBe("/calendar/2026/09/05");
  });
});
