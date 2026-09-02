import { describe, expect, it } from "vitest";
import { buildMonthDays, rotateWeekdays } from "@/components/ActivityCalendar/monthDays";

// May 2025 starts on a Thursday and ends on a Saturday.
const base = { month: "2025-05", data: {}, weekStartDayOffset: 0, today: "2025-05-16" };

describe("buildMonthDays", () => {
  it("pads a Sunday-first grid out to whole weeks", () => {
    const days = buildMonthDays(base);

    expect(days).toHaveLength(35);
    expect(days[0].date).toBe("2025-04-27");
    expect(days.at(-1)?.date).toBe("2025-05-31");
    expect(days.filter((day) => day.isCurrentMonth)).toHaveLength(31);
    expect(days.slice(0, 4).every((day) => !day.isCurrentMonth)).toBe(true);
  });

  it("realigns the padding when the week starts on Monday", () => {
    const days = buildMonthDays({ ...base, weekStartDayOffset: 1 });

    expect(days).toHaveLength(35);
    expect(days[0].date).toBe("2025-04-28");
    expect(days.at(-1)?.date).toBe("2025-06-01");
  });

  it("maps counts and flags onto the matching dates", () => {
    const days = buildMonthDays({ ...base, data: { "2025-05-02": 3 }, selectedDate: "2025-05-20" });
    const byDate = Object.fromEntries(days.map((day) => [day.date, day]));

    expect(byDate["2025-05-02"]).toMatchObject({ label: 2, count: 3 });
    expect(byDate["2025-05-16"].isToday).toBe(true);
    expect(byDate["2025-05-20"].isSelected).toBe(true);
    expect(days.filter((day) => day.isToday || day.isSelected)).toHaveLength(2);
  });
});

describe("rotateWeekdays", () => {
  const labels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  it("keeps Sunday first at offset 0 and moves Monday first at offset 1", () => {
    expect(rotateWeekdays(labels, 0)).toEqual(labels);
    expect(rotateWeekdays(labels, 1)).toEqual(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);
  });
});
