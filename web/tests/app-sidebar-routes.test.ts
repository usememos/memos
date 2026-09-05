import { describe, expect, it } from "vitest";
import { getRouteActionPolicy, getSidebarRouteKind, routeSupportsCollectionScope } from "@/components/AppSidebar/routes";

describe("sidebar route content", () => {
  it.each([
    ["/", "home"],
    ["/archived", "archived"],
    ["/explore", "explore"],
    ["/Explore/", "explore"],
    ["/ARCHIVED/", "archived"],
    ["/u/steven", "profile"],
    ["/U/Steven/", "profile"],
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

  it.each([
    ["/", true],
    ["/explore", true],
    ["/archived", false],
    ["/calendar", true],
    ["/calendar/2026/08/02", true],
    ["/attachments", true],
    ["/Explore/", true],
    ["/ARCHIVED/", false],
    ["/Attachments/", true],
    ["/u/steven", false],
    ["/inbox", false],
    ["/setting", false],
    ["/views", false],
    ["/about", false],
    ["/memos/abc", false],
    ["/memos/shares/token", false],
    ["/404", false],
  ])("reports whether %s supports the remembered collection scope", (path, expected) => {
    expect(routeSupportsCollectionScope(path)).toBe(expected);
  });

  it.each(["/", "/explore"])("keeps search and Compose in the remembered collection on %s", (path) => {
    expect(getRouteActionPolicy(path)).toEqual({
      searchScope: "remembered-collection",
      composePlacement: "remembered-space",
    });
  });

  it.each(["/archived", "/ARCHIVED/"])("keeps %s in the user archive without inheriting Space placement", (path) => {
    expect(getRouteActionPolicy(path)).toEqual({
      searchScope: "user-collection",
      composePlacement: "unassigned",
    });
  });

  it.each(["/attachments", "/calendar/2026/08/02"])("keeps the remembered scope when %s sends search to Home", (path) => {
    expect(getRouteActionPolicy(path)).toEqual({
      searchScope: "remembered-collection",
      searchDestination: "/",
      composePlacement: "remembered-space",
    });
  });

  it("keeps Profile search on Profile but makes Compose unassigned", () => {
    expect(getRouteActionPolicy("/u/steven")).toEqual({
      searchScope: "profile",
      searchDestination: "/u/steven",
      composePlacement: "unassigned",
    });
  });

  it("normalizes a Profile route without changing its spelling", () => {
    expect(getRouteActionPolicy("/U/Steven/")).toEqual({
      searchScope: "profile",
      searchDestination: "/U/Steven",
      composePlacement: "unassigned",
    });
  });

  it("keeps a normalized Explore route in the remembered scope", () => {
    const path = "/Explore/";
    expect(getRouteActionPolicy(path)).toEqual({
      searchScope: "remembered-collection",
      composePlacement: "remembered-space",
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
  ])("sends search to All and makes Compose unassigned on %s", (path) => {
    expect(getRouteActionPolicy(path)).toEqual({
      searchScope: "all",
      searchDestination: "/",
      composePlacement: "unassigned",
    });
  });
});
