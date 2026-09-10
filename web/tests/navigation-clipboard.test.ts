import { beforeEach, describe, expect, it } from "vitest";
import {
  addClip,
  addClipItem,
  addImageClip,
  addRichClip,
  buildClipWritePayload,
  clipPartKey,
  formatClipSize,
  NAV_CLIP_MAX_ITEMS,
  NAV_CLIP_TTL_MS,
  previewClip,
  pruneClips,
  readClips,
  removeClip,
  writeClips,
} from "@/modules/navigation/clipboard";

describe("navigation clipboard history", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("records clips newest-first and dedupes by text", () => {
    const now = 1_700_000_000_000;
    let items = addClip("https://example.com", now, []);
    items = addClip("hello world", now + 10, items);
    items = addClip("https://example.com", now + 20, items);

    expect(items).toHaveLength(2);
    expect(items[0].text).toBe("https://example.com");
    expect(items[0].createdAt).toBe(now + 20);
    expect(items[1].text).toBe("hello world");
  });

  it("records image clips with mime and size metadata", async () => {
    const now = 1_700_000_000_000;
    const png = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
    const items = await addImageClip(png, now, []);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("image");
    expect(items[0].mime).toBe("image/png");
    expect(items[0].size).toBe(4);
  });

  it("stores mixed html+image payloads as one rich clip", async () => {
    const now = 1_700_000_000_000;
    const png = new Blob([new Uint8Array([9, 9, 9])], { type: "image/png" });
    const items = await addRichClip(
      {
        "text/plain": "hello mixed",
        "text/html": "<p>hello <img src=x></p>",
        "image/png": png,
      },
      now,
      [],
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("rich");
    expect(items[0].parts).toEqual(expect.arrayContaining(["text/plain", "text/html", "image/png"]));
    expect(items[0].text).toContain("hello mixed");

    const payload = await buildClipWritePayload(items[0]);
    expect(Object.keys(payload).length).toBeGreaterThan(0);
    expect(clipPartKey(items[0].id, "text/html")).toBe(`${items[0].id}::text/html`);
  });

  it("dedupes binary clips by kind/mime/name/size", () => {
    const now = 1_700_000_000_000;
    let items = addClipItem({ kind: "image", text: "image/png", mime: "image/png", size: 10 }, now, []);
    items = addClipItem({ kind: "image", text: "image/png", mime: "image/png", size: 10 }, now + 1, items);
    expect(items).toHaveLength(1);
    expect(items[0].createdAt).toBe(now + 1);
  });

  it("expires entries after 24 hours", () => {
    const now = 1_700_000_000_000;
    const items = [
      { id: "old", kind: "text" as const, text: "stale", createdAt: now - NAV_CLIP_TTL_MS - 1 },
      { id: "fresh", kind: "text" as const, text: "fresh", createdAt: now - 1000 },
    ];
    const pruned = pruneClips(items, now);
    expect(pruned).toHaveLength(1);
    expect(pruned[0].id).toBe("fresh");
  });

  it("caps history size", () => {
    const now = 1_700_000_000_000;
    const many = Array.from({ length: NAV_CLIP_MAX_ITEMS + 10 }, (_, index) => ({
      id: `c-${index}`,
      kind: "text" as const,
      text: `text-${index}`,
      createdAt: now - index,
    }));
    expect(pruneClips(many, now)).toHaveLength(NAV_CLIP_MAX_ITEMS);
  });

  it("persists and reloads through localStorage", () => {
    writeClips([{ id: "a", kind: "text", text: "saved", createdAt: Date.now() }]);
    const loaded = readClips();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].text).toBe("saved");
    expect(removeClip("a", loaded)).toHaveLength(0);
  });

  it("previews long clips on one line", () => {
    const long = `line\n${"x".repeat(200)}`;
    const preview = previewClip(long, 20);
    expect(preview).not.toContain("\n");
    expect(preview.length).toBeLessThanOrEqual(20);
  });

  it("formats clip sizes", () => {
    expect(formatClipSize(512)).toBe("512 B");
    expect(formatClipSize(2048)).toBe("2 KB");
    expect(formatClipSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
