import { cn } from "@/lib/utils";
import type { HabitDay } from "@/types/proto/api/v1/habit_service_pb";

interface Props {
  days: HabitDay[];
  target: number;
}

const HabitMomentumChart = ({ days, target }: Props) => {
  const ceiling = Math.max(target, ...days.map((day) => day.value), 1);
  return (
    <div className="space-y-4">
      <div
        className="flex h-44 items-end gap-1.5 rounded-2xl border border-white/8 bg-black/15 px-3 pb-3 pt-5 sm:gap-2"
        role="group"
        aria-label="Fourteen day habit performance chart. A text summary follows."
      >
        {days.map((day) => {
          const height = day.recorded ? Math.max(8, Math.round((day.value / ceiling) * 100)) : 3;
          const weekday = new Intl.DateTimeFormat(undefined, { weekday: "narrow", timeZone: "UTC" }).format(
            new Date(`${day.date}T00:00:00Z`),
          );
          return (
            <div
              key={day.date}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
              title={`${day.date}: ${day.recorded ? `${day.value} minutes` : "not logged"}`}
            >
              <div
                className={cn(
                  "w-full max-w-8 rounded-t-md transition-[height] duration-500 motion-reduce:transition-none",
                  day.targetMet ? "bg-amber-400" : day.successful ? "bg-violet-400" : "bg-white/10",
                )}
                style={{ height: `${height}%` }}
              />
              <span className="text-[10px] font-medium text-slate-500">{weekday}</span>
            </div>
          );
        })}
      </div>
      <ul className="sr-only">
        {days.map((day) => (
          <li key={day.date}>
            {day.date}:{" "}
            {day.recorded
              ? `${day.value} minutes, ${day.targetMet ? "target met" : day.successful ? "minimum met" : "below minimum"}`
              : "not logged"}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-400" />
          Target met
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-violet-400" />
          Minimum met
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-white/10" />
          Missed or open
        </span>
      </div>
    </div>
  );
};

export default HabitMomentumChart;
