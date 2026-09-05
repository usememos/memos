export const ROUTES = {
  HOME: "/",
  ABOUT: "/about",
  ATTACHMENTS: "/attachments",
  INBOX: "/inbox",
  ARCHIVED: "/archived",
  CALENDAR: "/calendar",
  VIEWS: "/views",
  SETTING: "/setting",
  EXPLORE: "/explore",
  USER_PROFILE: "/u/:username",
  AUTH: "/auth",
  AUTH_SIGNUP: "/auth/signup",
  AUTH_ADMIN: "/auth/admin",
  AUTH_CALLBACK: "/auth/callback",
  SHARED_MEMO: "/memos/shares",
} as const;

/** Router pattern for the calendar: month and day are optional so `/calendar` can redirect. */
export const CALENDAR_ROUTE_PATTERN = `${ROUTES.CALENDAR}/:year?/:month?/:day?`;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
