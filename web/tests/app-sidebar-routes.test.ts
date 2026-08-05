import { describe, expect, it } from "vitest";
import { getSidebarRouteKind } from "@/components/AppSidebar/routes";

describe("sidebar route content", () => {
  it.each([
    ["/", "home"],
    ["/archived", "archived"],
    ["/explore", "explore"],
    ["/u/steven", "profile"],
    ["/shortcuts", "shortcuts"],
    ["/attachments", "attachments"],
    ["/inbox", "inbox"],
    ["/setting", "settings"],
    ["/memos/abc", "memo"],
    ["/memos/shares/token", "memo"],
    ["/about", "empty"],
    ["/404", "empty"],
  ])("maps %s to %s content", (path, kind) => {
    expect(getSidebarRouteKind(path)).toBe(kind);
  });
});
