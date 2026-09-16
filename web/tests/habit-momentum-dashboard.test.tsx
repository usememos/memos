import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HabitMomentumDashboard from "@/components/Habits/HabitMomentumDashboard";
import { HabitSchema, HabitSummarySchema } from "@/types/proto/api/v1/habit_service_pb";

const summary = create(HabitSummarySchema, {
  habit: create(HabitSchema, {
    name: "habits/reading",
    title: "Reading",
    identity: "Become a reader",
    cue: "After coffee, I will read",
    environment: "Keep the book on the table",
    minimumValue: 2,
    targetValue: 20,
    startDate: "2026-09-01",
  }),
  currentStreak: 3,
  bestStreak: 8,
  successfulDays: 10,
  targetDays: 6,
  trackedDays: 12,
  consistencyPercent: 83,
  targetPercent: 50,
  totalValue: 184n,
  xp: 100,
  level: 2,
  needsRecovery: true,
  recentDays: [
    { date: "2026-09-15", value: 0, recorded: true },
    { date: "2026-09-16", value: 0, recorded: false },
  ],
});

describe("HabitMomentumDashboard", () => {
  it("keeps recovery, consistency, and performance visibly separate", () => {
    render(<HabitMomentumDashboard summary={summary} today="2026-09-16" onLog={vi.fn()} onUndo={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByText("Never miss twice.")).toBeInTheDocument();
    expect(screen.getByText("83%")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("Level 2")).toBeInTheDocument();
    expect(screen.getByText(/minimum 2m/i)).toBeInTheDocument();
  });

  it("submits the measured value rather than a binary completion", async () => {
    const onLog = vi.fn().mockResolvedValue(undefined);
    render(<HabitMomentumDashboard summary={summary} today="2026-09-16" onLog={onLog} onUndo={vi.fn()} onEdit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Minutes today"), { target: { value: "27" } });
    fireEvent.click(screen.getByRole("button", { name: "Log it" }));
    expect(onLog).toHaveBeenCalledWith(27);
  });
});
