import { forwardRef } from "react";
import { Link, type LinkProps, useLocation } from "react-router-dom";
import { collectionPathForLocation } from "@/router/routes";

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
  const { pathname, search } = useLocation();
  return <Link ref={ref} to={{ pathname: collectionPathForLocation(to, pathname), search }} {...props} />;
});

CalendarLink.displayName = "CalendarLink";
