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
    ["/about", "empty"],
    ["/404", "empty"],
  ])("maps %s to %s content", (path, kind) => {
    expect(getSidebarRouteKind(path)).toBe(kind);
  });

  it.each([
    ["/", true],
    ["/explore", true],
    ["/archived", true],
    ["/attachments", true],
    ["/Explore/", true],
    ["/ARCHIVED/", true],
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

  it.each(["/", "/explore", "/archived"])("keeps search and Compose in the remembered collection on %s", (path) => {
    expect(getRouteActionPolicy(path)).toEqual({
      searchScope: "remembered-collection",
      composePlacement: "remembered-space",
    });
  });

  it("keeps the remembered scope when Attachments sends search to Home", () => {
    expect(getRouteActionPolicy("/attachments")).toEqual({
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

  it.each(["/Explore/", "/ARCHIVED/"])("keeps normalized collection route %s in the remembered scope", (path) => {
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
