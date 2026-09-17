import type { HabitSummary } from "@/types/proto/api/v1/habit_service_pb";

export type HabitRewardTier = "minimum" | "target" | "major";
export type HabitMajorReason = "level" | "streak";

export interface HabitCelebrationEvent {
  tier: HabitRewardTier;
  value: number;
  xpAwarded: number;
  lifetimeXp: number;
  level: number;
  currentStreak: number;
  minimumValue: number;
  targetValue: number;
  majorReasons: HabitMajorReason[];
}

interface ClassifyHabitRewardInput {
  before: HabitSummary;
  after: HabitSummary | undefined;
  value: number;
  wasRecorded: boolean;
}

export const isMajorHabitStreak = (streak: number) => streak === 7 || streak === 14 || streak === 30 || (streak > 0 && streak % 50 === 0);

export const classifyHabitReward = ({ before, after, value, wasRecorded }: ClassifyHabitRewardInput): HabitCelebrationEvent | null => {
  const habit = before.habit;
  if (wasRecorded || !habit || !after || value < habit.minimumValue) return null;

  const majorReasons: HabitMajorReason[] = [];
  if (after.level > before.level) majorReasons.push("level");
  if (isMajorHabitStreak(after.currentStreak)) majorReasons.push("streak");

  return {
    tier: majorReasons.length > 0 ? "major" : value >= habit.targetValue ? "target" : "minimum",
    value,
    xpAwarded: Math.max(0, after.xp - before.xp),
    lifetimeXp: after.xp,
    level: after.level,
    currentStreak: after.currentStreak,
    minimumValue: habit.minimumValue,
    targetValue: habit.targetValue,
    majorReasons,
  };
};
