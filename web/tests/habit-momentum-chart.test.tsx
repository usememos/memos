import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HabitMomentumChart from "@/components/Habits/HabitMomentumChart";
import type { HabitDay } from "@/types/proto/api/v1/habit_service_pb";

const day = (overrides: Partial<HabitDay>): HabitDay =>
  ({
    date: "2026-09-17",
    value: 0,
    recorded: false,
    successful: false,
    targetMet: false,
    ...overrides,
  }) as HabitDay;

describe("HabitMomentumChart", () => {
  it("uses indigo for a target day and green for a minimum day", () => {
    const { container } = render(
      <HabitMomentumChart
        target={20}
        days={[
          day({ value: 20, recorded: true, successful: true, targetMet: true }),
          day({ date: "2026-09-16", value: 2, recorded: true, successful: true }),
        ]}
      />,
    );

    const bars = container.querySelectorAll('[title*="minutes"] > div');
    expect(bars[0]).toHaveClass("bg-primary");
    expect(bars[1]).toHaveClass("bg-success");
    expect(container.querySelector(".bg-warning")).toBeNull();
  });
});
