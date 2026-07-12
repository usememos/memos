export const ROUTES = {
  HOME: "/",
  ABOUT: "/about",
  ATTACHMENTS: "/attachments",
  INBOX: "/inbox",
  ARCHIVED: "/archived",
  SHORTCUTS: "/shortcuts",
  SETTING: "/setting",
  EXPLORE: "/explore",
  AUTH: "/auth",
  GROUPS: "/groups",
  GROUP_TIMELINE: "/groups/:name",
  SHARED_MEMO: "/memos/shares",
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
