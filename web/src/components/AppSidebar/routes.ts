import { matchPath } from "react-router-dom";
import { isMemoScopeRoute, type MemoScope, resolveMemoScope } from "@/lib/memo-views";
import { ROUTES } from "@/router/routes";

export type SidebarRouteKind = MemoScope | "profile" | "views" | "attachments" | "inbox" | "settings" | "memo" | "empty";

export const getSidebarRouteKind = (path: string): SidebarRouteKind => {
  if (isMemoScopeRoute(path)) return resolveMemoScope(path);
  if (matchPath("/u/:username", path)) return "profile";
  if (path === ROUTES.VIEWS) return "views";
  if (path === ROUTES.ATTACHMENTS) return "attachments";
  if (path === ROUTES.INBOX) return "inbox";
  if (path === ROUTES.SETTING) return "settings";
  if (matchPath("/memos/:uid", path) || matchPath(`${ROUTES.SHARED_MEMO}/:token`, path)) return "memo";
  return "empty";
};
