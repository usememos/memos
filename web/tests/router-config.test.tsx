import { isValidElement } from "react";
import type { RouteObject } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { routeConfig, ROUTES } from "@/router";
import { RequireAuthRoute } from "@/router/guards";

// Walk the nested route config and find the first route with the given path,
// starting from the provided roots. Returns undefined if nothing matches.
function findByPath(routes: RouteObject[], path: string): RouteObject | undefined {
  for (const route of routes) {
    if (route.path === path) return route;
    const hit = route.children ? findByPath(route.children, path) : undefined;
    if (hit) return hit;
  }
  return undefined;
}

function elementType(route: RouteObject | undefined): unknown {
  if (!route?.element || !isValidElement(route.element)) return undefined;
  return route.element.type;
}

function hasAncestorOfType(routes: RouteObject[], path: string, guardType: unknown): boolean {
  const walk = (subtree: RouteObject[], ancestorGuards: unknown[]): boolean => {
    for (const route of subtree) {
      const nextAncestors = [...ancestorGuards];
      const type = elementType(route);
      if (type) nextAncestors.push(type);
      if (route.path === path) {
        return nextAncestors.includes(guardType);
      }
      if (route.children && walk(route.children, nextAncestors)) {
        return true;
      }
    }
    return false;
  };
  return walk(routes, []);
}

describe("router configuration", () => {
  it("has no in-app auth routes (authentication lives in Cloudflare Access)", () => {
    for (const path of ["callback", "admin", "signup"]) {
      expect(findByPath(routeConfig, path)).toBeUndefined();
    }
  });

  it("wraps authenticated-only pages in RequireAuthRoute", () => {
    for (const path of [ROUTES.ARCHIVED, ROUTES.ATTACHMENTS, ROUTES.INBOX, ROUTES.SETTING]) {
      expect(hasAncestorOfType(routeConfig, path, RequireAuthRoute)).toBe(true);
    }
  });

  it("leaves public pages outside RequireAuthRoute", () => {
    for (const path of [ROUTES.ABOUT, ROUTES.EXPLORE, "memos/:uid", "memos/shares/:token", "u/:username"]) {
      expect(hasAncestorOfType(routeConfig, path, RequireAuthRoute)).toBe(false);
    }
  });
});
