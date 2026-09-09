import { Navigate, useLocation, useParams } from "react-router-dom";
import { buildCalendarPath, CalendarView, parseCalendarParams } from "@/components/CalendarView";
import type { CalendarRouteParams } from "@/components/CalendarView/paths";
import { getCurrentMonth } from "@/lib/calendar-utils";
import { collectionPathForLocation } from "@/router/routes";

/** `/calendar/:year?/:month?/:day?` — anything that is not a real date lands on this month. */
const Calendar = () => {
  const location = useLocation();
  const state = parseCalendarParams(useParams<CalendarRouteParams>());
  if (!state) {
    return (
      <Navigate
        to={{ pathname: collectionPathForLocation(buildCalendarPath(getCurrentMonth()), location.pathname), search: location.search }}
        replace
      />
    );
  }
  return <CalendarView month={state.month} date={state.date} />;
};

export default Calendar;
