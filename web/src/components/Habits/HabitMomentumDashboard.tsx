import { CheckIcon, FlameIcon, PencilIcon, RotateCcwIcon, SparklesIcon, TargetIcon, TrophyIcon, ZapIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { HabitSummary } from "@/types/proto/api/v1/habit_service_pb";
import HabitMomentumChart from "./HabitMomentumChart";

interface Props {
  summary: HabitSummary;
  today: string;
  saving?: boolean;
  onLog: (value: number) => Promise<void>;
  onUndo: () => Promise<void>;
  onEdit: () => void;
}

const Metric = ({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: typeof FlameIcon;
  label: string;
  value: string;
  detail: string;
  accent: string;
}) => (
  <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
    <div className="mb-4 flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <Icon className={cn("size-4", accent)} />
    </div>
    <div className="text-3xl font-semibold tracking-tight text-white">{value}</div>
    <p className="mt-1 text-xs text-slate-500">{detail}</p>
  </div>
);

const daysLabel = (value: number) => `${value} ${value === 1 ? "day" : "days"}`;

const HabitMomentumDashboard = ({ summary, today, saving, onLog, onUndo, onEdit }: Props) => {
  const habit = summary.habit!;
  const todayEntry = summary.recentDays.find((day) => day.date === today);
  const [minutes, setMinutes] = useState(todayEntry?.recorded ? todayEntry.value : habit.targetValue);
  useEffect(() => {
    setMinutes(todayEntry?.recorded ? todayEntry.value : habit.targetValue);
  }, [habit.targetValue, todayEntry?.recorded, todayEntry?.value]);
  const status = useMemo(
    () => (minutes >= habit.targetValue ? "Target day" : minutes >= habit.minimumValue ? "Streak protected" : "Below minimum"),
    [habit.minimumValue, habit.targetValue, minutes],
  );
  const submit = async () => {
    try {
      await onLog(minutes);
      toast.success(
        minutes >= habit.minimumValue
          ? todayEntry?.successful
            ? "Today's performance updated"
            : "+10 XP — you showed up"
          : "Today's value saved",
      );
    } catch {
      toast.error("Could not save today's progress");
    }
  };
  return (
    <div className="space-y-5">
      {summary.needsRecovery && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-amber-100">
          <RotateCcwIcon className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Never miss twice.</p>
            <p className="mt-0.5 text-sm text-amber-100/70">
              The last completed check-in broke the chain. Your next action only needs {habit.minimumValue} minutes to start the recovery.
            </p>
          </div>
        </div>
      )}
      <section className="overflow-hidden rounded-3xl border border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_42%),linear-gradient(145deg,#111827,#090d16)] p-5 shadow-2xl shadow-black/20 sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
              <SparklesIcon className="size-4" />
              Identity-based habit
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{habit.title}</h1>
              <Button size="icon-compact" variant="ghost" onClick={onEdit} aria-label="Edit habit">
                <PencilIcon className="size-4" />
              </Button>
            </div>
            <p className="mt-2 max-w-xl text-base text-slate-400">
              Identity: <span className="text-slate-200">{habit.identity || habit.title}</span>
            </p>
          </div>
          <div className="min-w-72 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-white">Level {summary.level}</span>
              <span className="text-amber-300">{summary.xp} XP</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${summary.levelProgressXp}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {100 - summary.levelProgressXp} XP to level {summary.level + 1}
            </p>
          </div>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            icon={FlameIcon}
            label="Current streak"
            value={daysLabel(summary.currentStreak)}
            detail={`Best: ${daysLabel(summary.bestStreak)}`}
            accent="text-orange-400"
          />
          <Metric
            icon={TargetIcon}
            label="Consistency"
            value={`${summary.consistencyPercent}%`}
            detail={`${summary.successfulDays} of ${summary.trackedDays} elapsed days`}
            accent="text-violet-400"
          />
          <Metric
            icon={TrophyIcon}
            label="Target rate"
            value={`${summary.targetPercent}%`}
            detail={`${summary.targetDays} performance ${summary.targetDays === 1 ? "day" : "days"}`}
            accent="text-amber-400"
          />
          <Metric
            icon={ZapIcon}
            label="Total effort"
            value={`${summary.totalValue}m`}
            detail={`${summary.xp} lifetime XP`}
            accent="text-cyan-400"
          />
        </div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <section className="rounded-3xl border border-white/8 bg-slate-950 p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Performance, last 14 days</h2>
              <p className="mt-1 text-sm text-slate-500">
                Amber reaches the {habit.targetValue}-minute target. Violet still protects the chain.
              </p>
            </div>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{summary.totalValue} minutes total</span>
          </div>
          <HabitMomentumChart days={summary.recentDays} target={habit.targetValue} />
        </section>
        <section className="rounded-3xl border border-amber-400/20 bg-gradient-to-b from-amber-400/10 to-slate-950 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Today's action</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Log your minutes</h2>
            </div>
            {todayEntry?.successful && (
              <span className="flex size-10 items-center justify-center rounded-full bg-emerald-400 text-slate-950">
                <CheckIcon className="size-5" />
              </span>
            )}
          </div>
          <div className="mt-6 flex items-end gap-3">
            <label className="flex-1 space-y-2 text-sm text-slate-400">
              <span>Minutes</span>
              <Input
                aria-label="Minutes today"
                type="number"
                min={0}
                value={minutes}
                onChange={(event) => setMinutes(Math.max(0, Number(event.target.value)))}
                className="h-12 border-white/10 bg-black/25 text-xl text-white"
              />
            </label>
            <Button onClick={submit} disabled={saving} className="h-12 bg-amber-400 px-5 text-slate-950 hover:bg-amber-300">
              {saving ? "Saving…" : todayEntry?.recorded ? "Update" : "Log it"}
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className={minutes >= habit.minimumValue ? "text-emerald-300" : "text-slate-500"}>
              {status} · minimum {habit.minimumValue}m
            </span>
            {todayEntry?.recorded && (
              <button type="button" onClick={onUndo} className="text-slate-500 underline-offset-4 hover:text-white hover:underline">
                Undo today
              </button>
            )}
          </div>
        </section>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/8 bg-slate-950 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">Make it obvious and easy</p>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-white/[0.04] p-4">
              <p className="text-xs text-slate-500">Habit stack</p>
              <p className="mt-1 text-sm text-slate-200">{habit.cue || "Choose a reliable moment that already happens."}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.04] p-4">
              <p className="text-xs text-slate-500">Environment design</p>
              <p className="mt-1 text-sm text-slate-200">{habit.environment || "Put the cue where it is impossible to miss."}</p>
            </div>
          </div>
        </section>
        <section className="rounded-3xl border border-white/8 bg-slate-950 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">The chain</p>
          <div className="mt-5 grid grid-cols-7 gap-2">
            {summary.recentDays.slice(-7).map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${day.value} minutes`}
                className={cn(
                  "aspect-square rounded-xl border",
                  day.targetMet
                    ? "border-amber-300 bg-amber-400 shadow-lg shadow-amber-500/15"
                    : day.successful
                      ? "border-violet-300 bg-violet-400"
                      : day.recorded
                        ? "border-red-400/30 bg-red-400/10"
                        : "border-white/8 bg-white/[0.03]",
                )}
              />
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-500">
            A miss changes the next action, not your lifetime score. Show up for {habit.minimumValue} minutes and rebuild immediately.
          </p>
        </section>
      </div>
    </div>
  );
};
export default HabitMomentumDashboard;
