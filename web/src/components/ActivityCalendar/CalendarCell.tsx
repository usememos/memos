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
    if (onClick) {
      onClick(day.date);
    }
  };

  const sizeConfig = size === "small" ? SMALL_CELL_SIZE : DEFAULT_CELL_SIZE;

  // Two elements with two jobs: the cell spans its whole column and takes the pointer, the
  // chip inside it is the square that carries the fill and sets the row's height.
  const cellClasses = "group/day flex w-full items-center justify-center select-none";
  const chipClasses = cn(
    "relative flex aspect-square w-full items-center justify-center text-center transition-[background-color,color,filter,box-shadow] duration-150 ease-out",
    sizeConfig.font,
    sizeConfig.borderRadius,
    sizeConfig.maxSize,
  );
  const isInteractive = Boolean(onClick);
  const ariaLabel = day.isSelected ? `${tooltipText} (selected)` : tooltipText;

  if (!day.isCurrentMonth) {
    return (
      <div className={cn(cellClasses, "cursor-default")}>
        <span className={cn(chipClasses, "bg-transparent text-muted-foreground/25")}>{day.label}</span>
      </div>
    );
  }

  const intensityClass = getCellIntensityClass(day, maxCount);

  const chip = (
    <span
      className={cn(
        chipClasses,
        intensityClass,
        getCalendarCellStateClass(day),
        isInteractive &&
          "group-hover/day:brightness-[0.97] group-focus-visible/day:ring-2 group-focus-visible/day:ring-ring/40 group-focus-visible/day:ring-inset",
      )}
    >
      {day.label}
      {day.isToday && (
        <span
          aria-hidden="true"
          className="absolute bottom-[3px] left-1/2 size-[3px] -translate-x-1/2 rounded-full bg-blue-600/80 dark:bg-blue-300/80"
        />
      )}
    </span>
  );

  const button = (
    <button
      type="button"
      onClick={handleClick}
      tabIndex={isInteractive ? 0 : -1}
      aria-label={ariaLabel}
      aria-current={day.isToday ? "date" : undefined}
      aria-disabled={!isInteractive}
      className={cn(cellClasses, "p-0 focus-visible:outline-none", isInteractive ? "cursor-pointer" : "cursor-default")}
    >
      {chip}
    </button>
  );

  const shouldShowTooltip = day.count > 0 && tooltipText && !disableTooltip;

  if (!shouldShowTooltip) {
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
