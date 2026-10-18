import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { draftKeyFor, legacyDraftKeyFor, migrateLegacyDraft } from "@/components/MemoEditor/edit/draftKey";
import { cacheService } from "@/components/MemoEditor/edit/services/cacheService";

describe("draft keys", () => {
  it("follow what is edited", () => {
    expect(draftKeyFor({ kind: "edit", name: "memos/a" })).toBe("edit:memos/a");
    expect(draftKeyFor({ kind: "comment", parent: "memos/a" })).toBe("comment:memos/a");
    expect(draftKeyFor({ kind: "new", scope: "home" })).toBe("new:home");
    expect(draftKeyFor({ kind: "new", scope: "home", space: "spaces/work" })).toBe("new:home:spaces/work");
    expect(draftKeyFor({ kind: "new", scope: "calendar:2026-10-18" })).toBe("new:calendar:2026-10-18");
  });

  it("name the key each host chose before, where one existed", () => {
    expect(legacyDraftKeyFor({ kind: "comment", parent: "memos/a" })).toBe("memos/a-comment");
    expect(legacyDraftKeyFor({ kind: "new", scope: "home" })).toBe("home-memo-editor");
    expect(legacyDraftKeyFor({ kind: "new", scope: "global", space: "spaces/x" })).toBe("global-memo-editor:spaces/x");
    expect(legacyDraftKeyFor({ kind: "new", scope: "calendar:2026-10-18" })).toBe("calendar-day-editor:2026-10-18");
    expect(legacyDraftKeyFor({ kind: "new", scope: "map:users/1:all:35,135" })).toBe("map-editor:users/1:all:35,135");
    expect(legacyDraftKeyFor({ kind: "new", scope: "elsewhere" })).toBeUndefined();
    expect(legacyDraftKeyFor({ kind: "edit", name: "memos/a" })).toBeUndefined();
  });
});

describe("migrateLegacyDraft", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("moves a draft from the old key to the new one, once", () => {
    const identity = { kind: "new", scope: "home", space: "spaces/work" } as const;
    const oldKey = cacheService.key("users/1", "home-memo-editor:spaces/work");
    const newKey = cacheService.key("users/1", draftKeyFor(identity));
    cacheService.saveNow(oldKey, { content: "Unfinished", attachments: [] });

    migrateLegacyDraft("users/1", identity);

    expect(cacheService.loadDraft(newKey).content).toBe("Unfinished");
    expect(localStorage.getItem(oldKey)).toBeNull();
  });

  it("keeps a draft already under the new key", () => {
    const identity = { kind: "comment", parent: "memos/a" } as const;
    cacheService.saveNow(cacheService.key("users/1", "memos/a-comment"), { content: "old", attachments: [] });
    cacheService.saveNow(cacheService.key("users/1", draftKeyFor(identity)), { content: "new", attachments: [] });

    migrateLegacyDraft("users/1", identity);

    expect(cacheService.loadDraft(cacheService.key("users/1", draftKeyFor(identity))).content).toBe("new");
  });
});
