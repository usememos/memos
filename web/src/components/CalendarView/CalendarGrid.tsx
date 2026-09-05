import { useDirection } from "@base-ui/react/direction-provider";
import dayjs from "dayjs";
import { type KeyboardEvent, useLayoutEffect, useRef, useState } from "react";
import { type CalendarData, useMonthDays, useWeekdayLabels } from "@/components/ActivityCalendar";
import { useInstance } from "@/contexts/InstanceContext";
import { useView } from "@/contexts/ViewContext";
import { ISO_DATE_FORMAT } from "@/lib/calendar-utils";
import { CalendarDayCell, CELL_NUMBER_ROW, CELL_PADDING_Y, CELL_ROW_HEIGHT, CELL_ROWS_GAP } from "./CalendarDayCell";
import type { CalendarMonthModel } from "./dayModel";
import { getDefaultDate } from "./paths";

const DAYS_IN_WEEK = 7;

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
  /** Whether cells have room for memo rows; below md they only show a dot. */
  showRows: boolean;
}

const KEY_DELTAS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -DAYS_IN_WEEK, ArrowDown: DAYS_IN_WEEK };

/** Memo rows that fit under the day number in a cell of `cellHeight` px. */
export const rowsForCellHeight = (cellHeight: number): number =>
  Math.max(0, Math.floor((cellHeight - CELL_PADDING_Y - CELL_NUMBER_ROW - CELL_ROWS_GAP) / CELL_ROW_HEIGHT));

const cornerOf = (index: number, total: number): "ss" | "se" | "es" | "ee" | undefined => {
  if (index === 0) return "ss";
  if (index === DAYS_IN_WEEK - 1) return "se";
  if (index === total - DAYS_IN_WEEK) return "es";
  if (index === total - 1) return "ee";
  return undefined;
};

export const CalendarGrid = ({ month, monthLabel, today, counts, model, pending, selectedDate, showRows }: CalendarGridProps) => {
  const direction = useDirection();
  const { generalSetting } = useInstance();
  const { timeBasis } = useView();
  const containerRef = useRef<HTMLDivElement>(null);
  const cellsRef = useRef<HTMLDivElement>(null);
  const weekdayLabels = useWeekdayLabels(generalSetting.weekStartDayOffset);

  const days = useMonthDays({ month, data: counts, weekStartDayOffset: generalSetting.weekStartDayOffset, today, selectedDate });
  const firstDate = `${month}-01`;
  const lastDate = dayjs(firstDate).endOf("month").format(ISO_DATE_FORMAT);
  // One tab stop for the grid: the open day, else today, else the first of the month.
  const focusDate = selectedDate ?? getDefaultDate(month, today);
  const rowCount = Math.ceil(days.length / DAYS_IN_WEEK);

  // CSS sizes the rows (see the cells' grid-auto-rows); the cell height is only read back to
  // learn how many memo rows fit, and re-read whenever the grid itself resizes.
  const [visibleRows, setVisibleRows] = useState(2);
  useLayoutEffect(() => {
    const el = cellsRef.current;
    if (!el || !showRows) return;
    const apply = () => setVisibleRows(rowsForCellHeight(el.clientHeight / rowCount));
    apply();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [rowCount, showRows]);

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
      {/* Labels start on the cell's text axis (its padding); px-px offsets the grid's border. */}
      <div className="grid grid-cols-7 px-px" aria-hidden="true">
        {weekdayLabels.map((label) => (
          <div key={label} className="flex h-8 items-end px-3 pb-1.5">
            <span className="text-2xs leading-none text-muted-foreground/60">{label}</span>
          </div>
        ))}
      </div>
      {/* From xl the grid fills the sticky section, so the rows share its height evenly with a
          floor that keeps a number and two memo rows per day on short windows. */}
      <div
        ref={cellsRef}
        className="grid grid-cols-7 overflow-hidden rounded-lg border border-border/70 bg-card xl:min-h-0 xl:flex-1 xl:[grid-auto-rows:minmax(5.5rem,1fr)]"
      >
        {days.map((day, index) => (
          <CalendarDayCell
            key={day.date}
            day={day}
            summary={model[day.date]}
            visibleRows={showRows ? visibleRows : 0}
            pending={pending}
            timeBasis={timeBasis}
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
