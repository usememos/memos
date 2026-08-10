import { create } from "@bufbuild/protobuf";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cacheService } from "@/components/MemoEditor/services/cacheService";
import { AttachmentSchema, MotionMediaFamily, MotionMediaRole, MotionMediaSchema } from "@/types/proto/api/v1/attachment_service_pb";

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

    cacheService.saveNow(key, "- [x] Draft task");

    expect(cacheService.load(key)).toBe("- [x] Draft task");
  });

  it("removes empty draft content instead of caching it", () => {
    const key = cacheService.key("users/steven", "home-memo-editor");

    cacheService.saveNow(key, "");

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

    cacheService.saveNow(key, "![garden](/file/attachments/image-one)", [attachment]);

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

  it("keeps the cursor for the next editor mount", () => {
    const key = cacheService.key("users/steven", "global-memo-editor");

    cacheService.saveCursor(key, 9);

    expect(cacheService.loadCursor(key)).toBe(9);
    cacheService.clear(key);
    expect(cacheService.loadCursor(key)).toBeUndefined();
  });
});
