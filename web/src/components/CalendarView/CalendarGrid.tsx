import { useDirection } from "@base-ui/react/direction-provider";
import dayjs from "dayjs";
import { type KeyboardEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type CalendarData, calculateMaxCount, useMonthDays, useWeekdayLabels } from "@/components/ActivityCalendar";
import { useInstance } from "@/contexts/InstanceContext";
import { useView } from "@/contexts/ViewContext";
import { ISO_DATE_FORMAT } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";
import { CalendarDayCell, layoutForCellSize } from "./CalendarDayCell";
import type { CalendarMonthModel } from "./dayModel";
import { getDefaultDate } from "./paths";

const DAYS_IN_WEEK = 7;
/** A step under the 13px dates they head, so the column labels read as labels rather than as a row of dates. */
const WEEKDAY_LABEL_CLASSES = "mu-caption-xs leading-none text-mu-text-secondary";

export interface CalendarGridProps {
  /** `YYYY-MM` */
  month: string;
  /** Accessible name for the whole grid, e.g. "August 2026". */
  monthLabel: string;
  /** `YYYY-MM-DD` */
  today: string;
  /** Per-day counts from statistics: instant, and the skeleton layer while memos load. */
  counts: CalendarData;
  model: CalendarMonthModel;
  pending: boolean;
  selectedDate?: string;
  /** Below md the compact calendar shows tinted dates with a mark each, with the stream beneath. */
  showRows: boolean;
  /** No single creator is selected, so previews carry their author. */
  showAuthors: boolean;
}

const KEY_DELTAS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -DAYS_IN_WEEK, ArrowDown: DAYS_IN_WEEK };

const cornerOf = (index: number, total: number): "ss" | "se" | "es" | "ee" | undefined => {
  if (index === 0) return "ss";
  if (index === DAYS_IN_WEEK - 1) return "se";
  if (index === total - DAYS_IN_WEEK) return "es";
  if (index === total - 1) return "ee";
  return undefined;
};

export const CalendarGrid = ({
  month,
  monthLabel,
  today,
  counts,
  model,
  pending,
  selectedDate,
  showRows,
  showAuthors,
}: CalendarGridProps) => {
  const direction = useDirection();
  const { generalSetting } = useInstance();
  const { timeBasis } = useView();
  const containerRef = useRef<HTMLDivElement>(null);
  const cellsRef = useRef<HTMLDivElement>(null);
  const weekdayLabels = useWeekdayLabels(generalSetting.weekStartDayOffset);

  const days = useMonthDays({ month, data: counts, weekStartDayOffset: generalSetting.weekStartDayOffset, today, selectedDate });
  // The same all-time ceiling the sidebar heatmap uses, so a day reads the same tint in both.
  const maxCount = useMemo(() => calculateMaxCount(counts), [counts]);
  const firstDate = `${month}-01`;
  const lastDate = dayjs(firstDate).endOf("month").format(ISO_DATE_FORMAT);
  // One tab stop for the grid: the open day, else today, else the first of the month.
  const focusDate = selectedDate ?? getDefaultDate(month, today);
  const rowCount = Math.ceil(days.length / DAYS_IN_WEEK);

  // Observe both dimensions so previews adapt when the day panel or viewport resizes.
  const [cellSize, setCellSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = cellsRef.current;
    if (!el) return;
    const apply = () => setCellSize({ width: el.clientWidth / DAYS_IN_WEEK, height: el.clientHeight / rowCount });
    apply();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [rowCount, showRows]);
  // One layout for every cell, and a stable reference so unchanged cells skip re-rendering.
  const layout = useMemo(() => layoutForCellSize(cellSize.width, showRows ? cellSize.height : 0), [cellSize, showRows]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = (event.target as HTMLElement).dataset.calendarDate;
    if (!current) return;
    let next: string | undefined;
    if (event.key in KEY_DELTAS) {
      const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
      const delta = KEY_DELTAS[event.key] * (horizontal && direction === "rtl" ? -1 : 1);
      next = dayjs(current).add(delta, "day").format(ISO_DATE_FORMAT);
    } else if (event.key === "Home") {
      next = firstDate;
    } else if (event.key === "End") {
      next = lastDate;
    }
    if (!next) return;
    const target = containerRef.current?.querySelector<HTMLElement>(`[data-calendar-date="${next}"]`);
    if (!target) return;
    event.preventDefault();
    target.focus();
  };

  return (
    <div ref={containerRef} role="group" aria-label={monthLabel} className="flex min-h-0 w-full flex-1 flex-col" onKeyDown={handleKeyDown}>
      {/* Labels start on the cell's text axis: px-px offsets the grid's border, and each label
          pads by the cell's own border and padding, which narrow below sm and in slim columns. */}
      <div className="grid grid-cols-7 px-px" aria-hidden="true">
        {weekdayLabels.map((label) => (
          <div key={label} className={cn("flex h-8 items-end pb-1.5 ps-[7px]", layout.slim ? "sm:ps-[9px]" : "sm:ps-[13px]")}>
            <span className={WEEKDAY_LABEL_CLASSES}>{label}</span>
          </div>
        ))}
      </div>
      {/* From md the grid fills the viewport-tall section, so the rows share its height evenly
          with a floor that keeps the date and a short excerpt visible on short windows. */}
      <div
        ref={cellsRef}
        className="grid auto-rows-fr grid-cols-7 overflow-hidden rounded-mu-lg border border-mu-line/70 bg-mu-surface md:min-h-0 md:flex-1 md:[grid-auto-rows:minmax(5.5rem,1fr)]"
      >
        {days.map((day, index) => (
          <CalendarDayCell
            key={day.date}
            day={day}
            summary={model[day.date]}
            maxCount={maxCount}
            layout={layout}
            pending={pending}
            timeBasis={timeBasis}
            showAuthor={showAuthors}
            tabIndex={day.date === focusDate ? 0 : -1}
            isLastColumn={index % DAYS_IN_WEEK === DAYS_IN_WEEK - 1}
            isLastRow={index >= days.length - DAYS_IN_WEEK}
            corner={cornerOf(index, days.length)}
          />
        ))}
      </div>
    </div>
  );
};
