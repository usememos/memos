import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { memoVisualAspect } from "@/components/BentoGrid/bentoSpan";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const buildAttachment = (overrides: MessageInitShape<typeof AttachmentSchema>) =>
  create(AttachmentSchema, { name: "attachments/test", filename: "test.bin", type: "application/octet-stream", ...overrides });

const buildMemo = (overrides: MessageInitShape<typeof MemoSchema> = {}) =>
  create(MemoSchema, { name: "memos/main", content: "hello", attachments: [], ...overrides });

describe("memoVisualAspect", () => {
  it("reads the aspect ratio from attachment media metadata", () => {
    const memo = buildMemo({ attachments: [buildAttachment({ type: "image/jpeg", mediaMetadata: { width: 1600, height: 900 } })] });
    expect(memoVisualAspect(memo)).toBeCloseTo(16 / 9);
  });

  it("uses link cover dimensions when attachments have none", () => {
    const memo = create(MemoSchema, {
      name: "memos/cover",
      property: { links: [{ url: "https://example.com", coverAttachmentUid: "abc", coverWidth: 1200, coverHeight: 630 }] },
    });
    expect(memoVisualAspect(memo)).toBeCloseTo(1200 / 630);
  });

  it("returns undefined when dimensions are absent", () => {
    const memo = buildMemo({ attachments: [buildAttachment({ type: "image/jpeg" })] });
    expect(memoVisualAspect(memo)).toBeUndefined();
  });

  it("ignores zero or negative dimensions", () => {
    const memo = buildMemo({ attachments: [buildAttachment({ type: "image/jpeg", mediaMetadata: { width: 0, height: 900 } })] });
    expect(memoVisualAspect(memo)).toBeUndefined();
  });
});

describe("bentoCover text extraction", () => {
  it("extracts title and snippet for multi-line text memo", async () => {
    const { getBentoTileTitle, getBentoTileSnippet } = await import("@/components/MemoView/bentoCover");
    const memo = buildMemo({ content: "# Project Roadmap\nFirst milestone is due on Friday.\nSecond milestone next week." });
    expect(getBentoTileTitle(memo)).toBe("Project Roadmap");
    expect(getBentoTileSnippet(memo)).toBe("First milestone is due on Friday. Second milestone next week.");
  });

  it("handles single-line memo with empty snippet", async () => {
    const { getBentoTileTitle, getBentoTileSnippet } = await import("@/components/MemoView/bentoCover");
    const memo = buildMemo({ content: "Just a quick note." });
    expect(getBentoTileTitle(memo)).toBe("Just a quick note.");
    expect(getBentoTileSnippet(memo)).toBe("");
  });

  it("uses the first valid link hostname as the tile source", async () => {
    const { getBentoTileSource } = await import("@/components/MemoView/bentoCover");
    const memo = buildMemo({
      property: { links: [{ url: "not a url" }, { url: "https://www.example.com/reading/article" }] },
    });

    expect(getBentoTileSource(memo)).toBe("example.com");
  });

  it("omits the tile source when no valid link exists", async () => {
    const { getBentoTileSource } = await import("@/components/MemoView/bentoCover");

    expect(getBentoTileSource(buildMemo())).toBe("");
    expect(getBentoTileSource(buildMemo({ property: { links: [{ url: "not a url" }] } }))).toBe("");
  });
});
