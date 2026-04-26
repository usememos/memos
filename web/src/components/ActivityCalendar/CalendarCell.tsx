import { memo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DEFAULT_CELL_SIZE, SMALL_CELL_SIZE } from "./constants";
import type { CalendarDayCell, CalendarSize } from "./types";
import { getCalendarCellStateClass, getCellIntensityClass } from "./utils";

export interface CalendarCellProps {
  day: CalendarDayCell;
  maxCount: number;
  tooltipText: string;
  onClick?: (date: string) => void;
  size?: CalendarSize;
  disableTooltip?: boolean;
}

export const CalendarCell = memo((props: CalendarCellProps) => {
  const { day, maxCount, tooltipText, onClick, size = "default", disableTooltip = false } = props;

  const handleClick = () => {
    if (day.count > 0 && onClick) {
      onClick(day.date);
    }
  };

  const sizeConfig = size === "small" ? SMALL_CELL_SIZE : DEFAULT_CELL_SIZE;
  const smallExtraClasses = size === "small" ? `${SMALL_CELL_SIZE.dimensions} min-h-0` : "";

  const baseClasses = cn(
    "aspect-square w-full flex items-center justify-center text-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 select-none border border-border/10 bg-muted/20",
    sizeConfig.font,
    sizeConfig.borderRadius,
    smallExtraClasses,
  );
  const isInteractive = Boolean(onClick && day.count > 0);
  const ariaLabel = day.isSelected ? `${tooltipText} (selected)` : tooltipText;

  const intensityClass = getCellIntensityClass(day, maxCount);

  // Adjacent-month days (those shown to fill out the first/last grid row) keep
  // their heatmap color and click behavior so days with memos are never hidden
  // by the grid boundary, but are visually muted so it's still obvious they
  // aren't part of the current month. See #5816.
  const adjacentMonthClass = !day.isCurrentMonth ? "opacity-60" : "";

  const buttonClasses = cn(
    baseClasses,
    intensityClass,
    getCalendarCellStateClass(day),
    adjacentMonthClass,
    isInteractive ? "cursor-pointer hover:bg-muted/40 hover:border-border/30" : "cursor-default",
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

  const shouldShowTooltip = tooltipText && day.count > 0 && !disableTooltip;

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
