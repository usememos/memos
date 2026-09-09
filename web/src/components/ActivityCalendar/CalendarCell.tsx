import { memo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getChipClassName } from "./cellStyles";
import type { CalendarDayCell } from "./types";

export interface CalendarCellProps {
  day: CalendarDayCell;
  maxCount: number;
  tooltipText: string;
  onClick?: (date: string) => void;
}

/** The cell spans its whole column and takes the pointer; the chip inside it carries the fill. */
const CELL_CLASSES = "group/day flex w-full items-center justify-center select-none";

export const CalendarCell = memo(({ day, maxCount, tooltipText, onClick }: CalendarCellProps) => {
  const isInteractive = Boolean(onClick);

  if (!day.isCurrentMonth) {
    return (
      <div className={cn(CELL_CLASSES, "cursor-default")}>
        <span className={getChipClassName(day, maxCount, false)}>{day.label}</span>
      </div>
    );
  }

  const button = (
    <button
      type="button"
      onClick={() => onClick?.(day.date)}
      tabIndex={isInteractive ? 0 : -1}
      aria-label={day.isSelected ? `${tooltipText} (selected)` : tooltipText}
      aria-current={day.isToday ? "date" : undefined}
      aria-disabled={!isInteractive}
      className={cn(CELL_CLASSES, "p-0 focus-visible:outline-none", isInteractive ? "cursor-pointer" : "cursor-default")}
    >
      <span className={getChipClassName(day, maxCount, isInteractive)}>
        {day.label}
        {day.isToday && (
          <span
            aria-hidden="true"
            className="absolute bottom-[3px] left-1/2 size-[3px] -translate-x-1/2 rounded-full bg-blue-600/80 dark:bg-blue-300/80"
          />
        )}
      </span>
    </button>
  );

  if (day.count === 0) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="top">
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
});

CalendarCell.displayName = "CalendarCell";
