import { Navigate, useParams } from "react-router-dom";
import { buildCalendarPath, CalendarView, parseCalendarParams } from "@/components/CalendarView";
import type { CalendarRouteParams } from "@/components/CalendarView/paths";
import { getCurrentMonth } from "@/lib/calendar-utils";

/** `/calendar/:year?/:month?/:day?` — anything that is not a real date lands on this month. */
const Calendar = () => {
  const state = parseCalendarParams(useParams<CalendarRouteParams>());
  if (!state) {
    return <Navigate to={buildCalendarPath(getCurrentMonth())} replace />;
  }
  return <CalendarView month={state.month} date={state.date} />;
};

export default Calendar;
