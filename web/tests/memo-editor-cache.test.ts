import { create } from "@bufbuild/protobuf";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cacheService } from "@/components/MemoEditor/services/cacheService";
import { AttachmentSchema, MotionMediaFamily, MotionMediaRole, MotionMediaSchema } from "@/types/proto/api/v1/attachment_service_pb";

import { LocationSchema, Visibility } from "@/types/proto/api/v1/memo_service_pb";

describe("memo editor cache", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
    });
    cacheService.clearAll();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores draft content", () => {
    const key = cacheService.key("users/steven", "home-memo-editor");

    cacheService.saveNow(key, { content: "- [x] Draft task", attachments: [] });

    expect(cacheService.load(key)).toBe("- [x] Draft task");
  });

  it("removes empty draft content instead of caching it", () => {
    const key = cacheService.key("users/steven", "home-memo-editor");

    cacheService.saveNow(key, { content: "", attachments: [] });

    expect(cacheService.load(key)).toBe("");
  });

  it("loads content from previously structured draft entries", () => {
    const key = cacheService.key("users/steven", "home-memo-editor");
    localStorage.setItem(key, JSON.stringify({ kind: "memos.editor-cache", version: 1, content: "- [ ] migrated task" }));

    expect(cacheService.load(key)).toBe("- [ ] migrated task");
  });

  it("round-trips uploaded attachment metadata with a structured draft", () => {
    const key = cacheService.key("users/steven", "home-memo-editor");
    const attachment = create(AttachmentSchema, {
      name: "attachments/image-one",
      filename: "garden.png",
      externalLink: "https://cdn.example.com/garden.png",
      type: "image/png",
      size: 42n,
      motionMedia: create(MotionMediaSchema, {
        family: MotionMediaFamily.APPLE_LIVE_PHOTO,
        role: MotionMediaRole.STILL,
        groupId: "live-one",
      }),
    });

    cacheService.saveNow(key, { content: "![garden](/file/attachments/image-one)", attachments: [attachment] });

    const restored = cacheService.loadDraft(key);
    expect(restored.content).toBe("![garden](/file/attachments/image-one)");
    expect(restored.attachments).toHaveLength(1);
    expect(restored.attachments[0]).toMatchObject({
      name: "attachments/image-one",
      filename: "garden.png",
      externalLink: "https://cdn.example.com/garden.png",
      type: "image/png",
      size: 42n,
      motionMedia: {
        family: MotionMediaFamily.APPLE_LIVE_PHOTO,
        role: MotionMediaRole.STILL,
        groupId: "live-one",
      },
    });
  });

  it("keeps raw JSON markdown drafts intact", () => {
    const key = cacheService.key("users/steven", "home-memo-editor");
    const jsonDraft = '{"content":"not a cache envelope"}';
    localStorage.setItem(key, jsonDraft);

    expect(cacheService.load(key)).toBe(jsonDraft);
  });

  it("keeps structured-looking drafts without a supported version intact", () => {
    const key = cacheService.key("users/steven", "home-memo-editor");
    const jsonDraft = JSON.stringify({ kind: "memos.editor-cache", content: "not a supported envelope" });
    localStorage.setItem(key, jsonDraft);

    expect(cacheService.load(key)).toBe(jsonDraft);
  });

  it("round-trips an edited or removed location and isolates Space drafts", () => {
    const point = create(LocationSchema, { latitude: 0, longitude: 135, placeholder: "Cafe" });
    cacheService.saveNow("map:space-a:point", { content: "draft", attachments: [], location: point });
    cacheService.saveNow("map:space-b:point", { content: "draft", attachments: [], location: null });
    expect(cacheService.loadDraft("map:space-a:point").location).toEqual(point);
    expect(cacheService.loadDraft("map:space-b:point").location).toBeNull();
    localStorage.setItem("legacy", JSON.stringify({ kind: "memos.editor-cache", version: 2, content: "old", attachments: [] }));
    expect(cacheService.loadDraft("legacy").location).toBeUndefined();
  });

  it("persists a chosen destination before typing, and clears it with the draft", () => {
    cacheService.saveNow("destination", { content: "", attachments: [], space: "spaces/work", visibility: Visibility.PRIVATE });
    expect(cacheService.loadDraft("destination")).toMatchObject({ space: "spaces/work", visibility: Visibility.PRIVATE });
    cacheService.saveNow("destination", { content: "draft", attachments: [], visibility: Visibility.PRIVATE });
    expect(cacheService.loadDraft("destination").space).toBeUndefined();
    cacheService.clear("destination");
    expect(cacheService.loadDraft("destination").space).toBeUndefined();
  });

  it("ignores invalid cached settings while preserving legacy content and location", () => {
    localStorage.setItem(
      "legacy-location",
      JSON.stringify({ kind: "memos.editor-cache", version: 3, content: "old", location: null, space: 42, visibility: 999 }),
    );
    expect(cacheService.loadDraft("legacy-location")).toMatchObject({
      content: "old",
      location: null,
      space: undefined,
      visibility: undefined,
    });
  });

  it("keeps the cursor for the next editor mount", () => {
    const key = cacheService.key("users/steven", "global-memo-editor");

    cacheService.saveCursor(key, 9);

    expect(cacheService.loadCursor(key)).toBe(9);
    cacheService.clear(key);
    expect(cacheService.loadCursor(key)).toBeUndefined();
  });
});
