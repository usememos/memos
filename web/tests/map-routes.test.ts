import { describe, expect, it } from "vitest";
import { getRouteActionPolicy, getSidebarRouteKind } from "@/components/AppSidebar/routes";
import { createMemoNavigationState, resolveMemoDetailOrigin, withMemoFilter } from "@/components/MemoView/navigation";
import { isMemoCollectionRoute } from "@/lib/memo-views";
import { getSpaceSwitchPath, resolveCollectionRoute } from "@/router/routes";

describe("map navigation", () => {
  it.each(["/map", "/spaces/travel/map"])("recognizes %s as a filterable collection", (pathname) => {
    expect(resolveCollectionRoute(pathname).isCollection).toBe(true);
    expect(isMemoCollectionRoute(pathname)).toBe(true);
    expect(getSidebarRouteKind(pathname)).toBe("map");
  });
  it("preserves viewport, selection and filters across Space switches and memo detail", () => {
    const search = "?lat=35&lng=135&zoom=14&memo=memos%2Fone&filter=tagSearch%3Atravel";
    expect(getSpaceSwitchPath({ pathname: "/map", search }, "spaces/travel")).toBe(`/spaces/travel/map${search}`);
    expect(resolveMemoDetailOrigin(createMemoNavigationState(`/map${search}`))).toBe(`/map${search}`);
    expect(withMemoFilter(`/map${search}`, "tagSearch:food")).toContain("lat=35&lng=135&zoom=14&memo=memos%2Fone&filter=tagSearch%3Afood");
  });
  it("sends Quick Find to Home within the active collection", () => {
    expect(getRouteActionPolicy("/map")).toEqual({ searchScope: "route-collection", searchDestination: "/" });
    expect(getRouteActionPolicy("/spaces/travel/map")).toEqual({ searchScope: "route-collection", searchDestination: "/spaces/travel" });
  });
});
