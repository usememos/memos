import { describe, expect, it } from "vitest";
import { getRouteActionPolicy, getSidebarRouteKind } from "@/components/AppSidebar/routes";

describe("sidebar route content", () => {
  it.each([
    ["/", "home"],
    ["/archived", "archived"],
    ["/explore", "explore"],
    ["/Explore/", "explore"],
    ["/ARCHIVED/", "archived"],
    ["/u/steven", "common"],
    ["/U/Steven/", "common"],
    ["/views", "views"],
    ["/Views/", "views"],
    ["/calendar", "calendar"],
    ["/calendar/2026/08", "calendar"],
    ["/Calendar/2026/08/02/", "calendar"],
    ["/attachments", "attachments"],
    ["/Attachments/", "attachments"],
    ["/inbox", "inbox"],
    ["/Inbox/", "inbox"],
    ["/setting", "settings"],
    ["/Setting/", "settings"],
    ["/memos/abc", "memo"],
    ["/Memos/ABC/", "memo"],
    ["/memos/shares/token", "memo"],
    ["/Memos/Shares/token/", "memo"],
    ["/about", "common"],
    ["/403", "common"],
    ["/404", "common"],
    ["/unknown", "common"],
  ])("maps %s to %s content", (path, kind) => {
    expect(getSidebarRouteKind(path)).toBe(kind);
  });

  it.each(["/", "/explore"])("keeps search in the route collection on %s", (path) => {
    expect(getRouteActionPolicy(path)).toEqual({
      searchScope: "route-collection",
    });
  });

  it.each(["/archived", "/ARCHIVED/"])("keeps %s in the user archive", (path) => {
    expect(getRouteActionPolicy(path)).toEqual({
      searchScope: "user-collection",
    });
  });

  it.each(["/attachments", "/calendar/2026/08/02"])("keeps the All scope when %s sends search to Explore", (path) => {
    expect(getRouteActionPolicy(path)).toEqual({
      searchScope: "route-collection",
      searchDestination: "/explore",
    });
  });

  it("keeps a creator when Calendar sends search to Home", () => {
    expect(getRouteActionPolicy("/spaces/a/calendar/2026/08/02", "?creator=alice")).toEqual({
      searchScope: "route-collection",
      searchDestination: "/spaces/a",
    });
  });

  it("keeps a normalized Explore route in the route scope", () => {
    const path = "/Explore/";
    expect(getRouteActionPolicy(path)).toEqual({
      searchScope: "route-collection",
    });
  });

  it.each([
    "/inbox",
    "/setting",
    "/views",
    "/about",
    "/memos/abc",
    "/memos/shares/token",
    "/403",
    "/404",
    "/unknown",
  ])("sends search to All on %s", (path) => {
    expect(getRouteActionPolicy(path)).toEqual({
      searchScope: "all",
      searchDestination: "/explore",
    });
  });
});
