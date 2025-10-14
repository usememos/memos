import { memo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CalendarDayCell } from "./types";
import { getCellIntensityClass } from "./utils";

interface CalendarCellProps {
  day: CalendarDayCell;
  maxCount: number;
  tooltipText: string;
  onClick?: (date: string) => void;
}

export const CalendarCell = memo((props: CalendarCellProps) => {
  const { day, maxCount, tooltipText, onClick } = props;

  const handleClick = () => {
    if (day.count > 0 && onClick) {
      onClick(day.date);
    }
  };

  const baseClasses =
    "w-full h-7 rounded-md border text-xs flex items-center justify-center text-center transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background select-none";
  const isInteractive = Boolean(onClick && day.count > 0);
  const ariaLabel = day.isSelected ? `${tooltipText} (selected)` : tooltipText;

  if (!day.isCurrentMonth) {
    return (
      <div className={cn(baseClasses, "border-transparent text-muted-foreground/60 bg-transparent pointer-events-none opacity-80")}>
        {day.label}
      </div>
    );
  }

  const intensityClass = getCellIntensityClass(day, maxCount);

  const buttonClasses = cn(
    baseClasses,
    "border-transparent text-muted-foreground",
    day.isToday && "border-border",
    day.isSelected && "border-border font-medium",
    day.isWeekend && "text-muted-foreground/80",
    intensityClass,
    isInteractive ? "cursor-pointer hover:scale-105" : "cursor-default",
  );

  const button = (
    <button
      type="button"
      onClick={handleClick}
      tabIndex={isInteractive ? 0 : -1}
      aria-label={ariaLabel}
      aria-current={day.isToday ? "date" : undefined}
      aria-disabled={!isInteractive}
      className={buttonClasses}
    >
      {day.label}
    </button>
  );

  if (!tooltipText) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top">
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
});

CalendarCell.displayName = "CalendarCell";
