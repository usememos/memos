import { describe, expect, it } from "vitest";
import {
  createMemoNavigationState,
  isMemoCollectionOrigin,
  isMemoDetailPath,
  isMemoResourcePath,
  resolveMemoDetailOrigin,
  resolveMemoOrigin,
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

  it("marks collection cards as preserving the remembered scope", () => {
    expect(resolveMemoOrigin({ pathname: "/explore", search: "?filter=tagSearch%3Awork", memoName: "memos/123" })).toEqual({
      parentPage: "/explore?filter=tagSearch%3Awork",
      parentScope: "preserve",
    });
  });

  it("marks Profile cards as global without losing their Profile origin", () => {
    expect(resolveMemoOrigin({ pathname: "/u/alice", search: "?view=map", memoName: "memos/123" })).toEqual({
      parentPage: "/u/alice?view=map",
      parentScope: "all",
    });
  });

  it("uses an All Home origin for direct and shared resource entries", () => {
    expect(resolveMemoDetailOrigin(undefined)).toEqual({ parentPage: "/", parentScope: "all" });
    expect(resolveMemoDetailOrigin({ unrelated: true })).toEqual({ parentPage: "/", parentScope: "all" });
  });

  it("uses a user-level Archived origin without changing the remembered Space", () => {
    expect(resolveMemoDetailOrigin(undefined, { memoArchived: true })).toEqual({ parentPage: "/archived", parentScope: "preserve" });
  });

  it("keeps an explicit origin ahead of the archived fallback", () => {
    expect(resolveMemoDetailOrigin(createMemoNavigationState("/u/alice", "all"), { memoArchived: true })).toEqual({
      parentPage: "/u/alice",
      parentScope: "all",
    });
  });

  it("round-trips an explicit origin policy through router state", () => {
    const state = createMemoNavigationState("/", "preserve");
    expect(resolveMemoDetailOrigin(state)).toEqual({ parentPage: "/", parentScope: "preserve" });
  });

  it("infers policy for legacy from-only router state", () => {
    expect(resolveMemoDetailOrigin({ from: "/archived" })).toEqual({ parentPage: "/archived", parentScope: "preserve" });
    expect(resolveMemoDetailOrigin({ from: "/u/alice" })).toEqual({ parentPage: "/u/alice", parentScope: "all" });
  });

  it.each([
    "/",
    "/explore?filter=tagSearch%3Awork",
    "/archived",
    "/attachments",
  ])("recognizes %s as a remembered collection origin", (page) => {
    expect(isMemoCollectionOrigin(page)).toBe(true);
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
