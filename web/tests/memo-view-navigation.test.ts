import { describe, expect, it } from "vitest";
import {
  createMemoNavigationState,
  isMemoDetailPath,
  isMemoResourcePath,
  resolveMemoDetailOrigin,
  resolveMemoParentPage,
  withMemoFilter,
} from "@/components/MemoView/navigation";

describe("memo view navigation", () => {
  it("captures the complete collection origin", () => {
    expect(
      resolveMemoParentPage({
        pathname: "/archived",
        search: "?filter=tagSearch%3Awork",
        memoName: "memos/123",
      }),
    ).toBe("/archived?filter=tagSearch%3Awork");
  });

  it("keeps an explicit origin on a canonical memo route", () => {
    expect(
      resolveMemoParentPage({
        explicitParentPage: "/explore?filter=contentSearch%3Aroadmap",
        pathname: "/memos/123",
        search: "",
        memoName: "memos/123",
      }),
    ).toBe("/explore?filter=contentSearch%3Aroadmap");
  });

  it("keeps a Profile map origin intact", () => {
    expect(resolveMemoParentPage({ pathname: "/u/alice", search: "?view=map", memoName: "memos/123" })).toBe("/u/alice?view=map");
  });

  it("uses Home for direct and shared resource entries", () => {
    expect(resolveMemoDetailOrigin(undefined)).toBe("/");
    expect(resolveMemoDetailOrigin({ unrelated: true })).toBe("/");
  });

  it("uses the user archive for a direct entry to an archived memo", () => {
    expect(resolveMemoDetailOrigin(undefined, { memoArchived: true })).toBe("/archived");
  });

  it("keeps an explicit origin ahead of the archived fallback", () => {
    expect(resolveMemoDetailOrigin(createMemoNavigationState("/u/alice"), { memoArchived: true })).toBe("/u/alice");
  });

  it("round-trips an explicit origin through router state", () => {
    expect(resolveMemoDetailOrigin(createMemoNavigationState("/explore?filter=tagSearch%3Awork"))).toBe("/explore?filter=tagSearch%3Awork");
  });

  it.each([
    "/memos/123",
    "/memos/123/",
    "/Memos/123",
    "/memos/shares/token",
    "/Memos/Shares/token/",
  ])("does not treat %s as its own origin", (pathname) => {
    expect(isMemoDetailPath(pathname, "memos/123")).toBe(true);
    expect(resolveMemoParentPage({ pathname, search: "", memoName: "memos/123" })).toBe("/");
  });

  it("does not confuse a different memo route with the current memo detail", () => {
    const pathname = "/memos/1234";
    expect(isMemoDetailPath(pathname, "memos/123")).toBe(false);
    expect(resolveMemoParentPage({ pathname, search: "", memoName: "memos/123" })).toBe(pathname);
  });

  it("rejects extra path segments after a share token", () => {
    expect(isMemoDetailPath("/memos/shares/token/extra", "memos/123")).toBe(false);
  });

  it.each([
    "/memos/123",
    "/Memos/123/",
    "/memos/shares/token",
    "/Memos/Shares/token/",
  ])("recognizes %s as a Memo resource route", (pathname) => {
    expect(isMemoResourcePath(pathname)).toBe(true);
  });

  it.each(["/", "/memos", "/memos/123/extra", "/memos/shares/token/extra"])("rejects %s as a Memo resource route", (pathname) => {
    expect(isMemoResourcePath(pathname)).toBe(false);
  });

  it("replaces the filter without dropping other origin query parameters", () => {
    expect(withMemoFilter("/u/alice?view=memos&filter=old#section", "tagSearch:design")).toBe(
      "/u/alice?view=memos&filter=tagSearch%3Adesign",
    );
  });

  it("returns a Profile map origin to its memo list when applying a filter", () => {
    expect(withMemoFilter("/u/alice?view=map", "tagSearch:design")).toBe("/u/alice?filter=tagSearch%3Adesign");
  });
});
