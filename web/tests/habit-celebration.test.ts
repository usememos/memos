import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { classifyHabitReward, isMajorHabitStreak } from "@/components/Habits/habitCelebration";
import { HabitSchema, HabitSummarySchema } from "@/types/proto/api/v1/habit_service_pb";

const makeSummary = (overrides: { currentStreak?: number; xp?: number; level?: number } = {}) =>
  create(HabitSummarySchema, {
    habit: create(HabitSchema, {
      name: "habits/reading",
      title: "Reading",
      minimumValue: 2,
      targetValue: 20,
      startDate: "2026-09-01",
    }),
    currentStreak: overrides.currentStreak ?? 6,
    xp: overrides.xp ?? 80,
    level: overrides.level ?? 1,
  });

describe("classifyHabitReward", () => {
  it("keeps below-minimum first logs quiet", () => {
    expect(classifyHabitReward({ before: makeSummary(), after: makeSummary(), value: 1, wasRecorded: false })).toBeNull();
  });

  it("returns minimum and target tiers from authoritative summaries", () => {
    expect(classifyHabitReward({ before: makeSummary(), after: makeSummary({ xp: 90 }), value: 2, wasRecorded: false })?.tier).toBe(
      "minimum",
    );
    expect(classifyHabitReward({ before: makeSummary(), after: makeSummary({ xp: 90 }), value: 20, wasRecorded: false })?.tier).toBe(
      "target",
    );
  });

  it("gives target precedence when minimum equals target", () => {
    const before = makeSummary();
    before.habit!.minimumValue = 20;
    expect(classifyHabitReward({ before, after: makeSummary({ xp: 90 }), value: 20, wasRecorded: false })?.tier).toBe("target");
  });

  it("uses the major tier for a level increase", () => {
    expect(
      classifyHabitReward({
        before: makeSummary({ xp: 90, level: 1 }),
        after: makeSummary({ xp: 100, level: 2 }),
        value: 20,
        wasRecorded: false,
      })?.tier,
    ).toBe("major");
  });

  it("uses the major tier for a configured streak milestone", () => {
    expect(
      classifyHabitReward({
        before: makeSummary({ currentStreak: 13, xp: 120, level: 2 }),
        after: makeSummary({ currentStreak: 14, xp: 130, level: 2 }),
        value: 20,
        wasRecorded: false,
      })?.tier,
    ).toBe("major");
  });

  it("returns one major event containing simultaneous level and streak reasons", () => {
    const event = classifyHabitReward({
      before: makeSummary({ currentStreak: 6, xp: 90, level: 1 }),
      after: makeSummary({ currentStreak: 7, xp: 100, level: 2 }),
      value: 24,
      wasRecorded: false,
    });
    expect(event).toMatchObject({ tier: "major", majorReasons: ["level", "streak"], level: 2, currentStreak: 7, xpAwarded: 10 });
  });

  it("never rewards edits or missing authoritative results", () => {
    expect(classifyHabitReward({ before: makeSummary(), after: makeSummary({ level: 2 }), value: 20, wasRecorded: true })).toBeNull();
    expect(classifyHabitReward({ before: makeSummary(), after: undefined, value: 20, wasRecorded: false })).toBeNull();
  });
});

describe("isMajorHabitStreak", () => {
  it.each([7, 14, 30, 50, 100])("recognizes %i days", (streak) => expect(isMajorHabitStreak(streak)).toBe(true));
  it.each([0, 6, 8, 29, 49, 51])("rejects %i days", (streak) => expect(isMajorHabitStreak(streak)).toBe(false));
});
