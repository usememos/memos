import { forwardRef } from "react";
import { Link, type LinkProps, useLocation } from "react-router-dom";

export interface CalendarLinkProps extends Omit<LinkProps, "to"> {
  /** Pathname only; the current search string rides along so view and tag filters survive. */
  to: string;
}

/**
 * Every link inside the calendar keeps `?filter=`: the layout drops filters on a pathname
 * change unless the query still carries them, and moving between months and days is a
 * pathname change.
 */
export const CalendarLink = forwardRef<HTMLAnchorElement, CalendarLinkProps>(({ to, ...props }, ref) => {
  const { search } = useLocation();
  return <Link ref={ref} to={{ pathname: to, search }} {...props} />;
});

CalendarLink.displayName = "CalendarLink";
