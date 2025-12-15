import { memo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DEFAULT_CELL_SIZE, SMALL_CELL_SIZE } from "./constants";
import type { CalendarDayCell, CalendarSize } from "./types";
import { getCellIntensityClass } from "./utils";

export interface CalendarCellProps {
  day: CalendarDayCell;
  maxCount: number;
  tooltipText: string;
  onClick?: (date: string) => void;
  size?: CalendarSize;
}

export const CalendarCell = memo((props: CalendarCellProps) => {
  const { day, maxCount, tooltipText, onClick, size = "default" } = props;

  const handleClick = () => {
    if (day.count > 0 && onClick) {
      onClick(day.date);
    }
  };

  const sizeConfig = size === "small" ? SMALL_CELL_SIZE : DEFAULT_CELL_SIZE;
  const smallExtraClasses = size === "small" ? `${SMALL_CELL_SIZE.dimensions} min-h-0` : "";

  const baseClasses = cn(
    "aspect-square w-full border flex items-center justify-center text-center transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background select-none",
    sizeConfig.font,
    sizeConfig.borderRadius,
    smallExtraClasses,
  );
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
    (day.isToday || day.isSelected) && "border-border",
    day.isSelected && "font-medium",
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

  const shouldShowTooltip = tooltipText && day.count > 0;

  if (!shouldShowTooltip) {
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
