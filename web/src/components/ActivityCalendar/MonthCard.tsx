import { CompactMonthCalendar, getMonthLabel } from "@/components/ActivityCalendar";
import { cn } from "@/lib/utils";
import type { MonthCardProps } from "./types";

export const MonthCard = ({ month, data, maxCount, onClick, className }: MonthCardProps) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 sm:gap-1.5 rounded-lg border bg-card p-1.5 sm:p-2 md:p-2.5 shadow-sm hover:shadow-md hover:border-border/60 transition-all duration-200",
        className,
      )}
    >
      <div className="text-xs font-semibold text-foreground text-center tracking-tight">{getMonthLabel(month)}</div>
      <CompactMonthCalendar month={month} data={data} maxCount={maxCount} size="small" onClick={onClick} />
    </div>
  );
};
