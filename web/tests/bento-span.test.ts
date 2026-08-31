import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { BENTO_ROW_UNIT, bentoSpan, isFeaturedMemo, memoVisualAspect } from "@/components/BentoGrid/bentoSpan";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const buildAttachment = (overrides: MessageInitShape<typeof AttachmentSchema>) =>
  create(AttachmentSchema, { name: "attachments/test", filename: "test.bin", type: "application/octet-stream", ...overrides });

const buildMemo = (overrides: MessageInitShape<typeof MemoSchema> = {}) =>
  create(MemoSchema, { name: "memos/main", content: "hello", attachments: [], ...overrides });

const COLUMN_WIDTH = 320;

describe("bentoSpan", () => {
  it("shapes landscape media into wide tiles sized by aspect", () => {
    // 16:9 landscape: two columns wide, height (2*320+12)/1.78 ≈ 366px → 2 rows of 260.
    const memo = buildMemo({ attachments: [buildAttachment({ type: "image/jpeg", mediaMetadata: { width: 1600, height: 900 } })] });
    expect(memoVisualAspect(memo)).toBeCloseTo(16 / 9);
    expect(bentoSpan(memo, { columnCount: 3, columnWidth: COLUMN_WIDTH })).toEqual({ colSpan: 2, rowSpan: 2 });
  });

  it("shapes portrait media into tall single-column tiles", () => {
    // 2:3 portrait: one column, height 320/0.667 ≈ 480px → 2 rows.
    const memo = buildMemo({ attachments: [buildAttachment({ type: "image/jpeg", mediaMetadata: { width: 800, height: 1200 } })] });
    expect(bentoSpan(memo, { columnCount: 3, columnWidth: COLUMN_WIDTH })).toEqual({ colSpan: 1, rowSpan: 2 });
    // Extreme portrait caps at 3 rows.
    const tall = buildMemo({ attachments: [buildAttachment({ type: "image/jpeg", mediaMetadata: { width: 400, height: 2000 } })] });
    expect(bentoSpan(tall, { columnCount: 3, columnWidth: COLUMN_WIDTH }).rowSpan).toBe(3);
  });

  it("uses link cover dimensions like attachment dimensions", () => {
    const memo = create(MemoSchema, {
      name: "memos/cover",
      property: { links: [{ url: "https://example.com", coverAttachmentUid: "abc", coverWidth: 1200, coverHeight: 630 }] },
    });
    expect(memoVisualAspect(memo)).toBeCloseTo(1200 / 630);
    expect(bentoSpan(memo, { columnCount: 3, columnWidth: COLUMN_WIDTH }).colSpan).toBe(2);
  });

  it("falls back to the estimator when dimensions are absent", () => {
    const memo = buildMemo({ attachments: [buildAttachment({ type: "image/jpeg" })] });
    expect(memoVisualAspect(memo)).toBeUndefined();
    expect(bentoSpan(memo, { columnCount: 3, columnWidth: COLUMN_WIDTH })).toEqual({ colSpan: 2, rowSpan: 2 });
  });
  it("degenerates to 1x1 below two columns", () => {
    expect(bentoSpan(buildMemo({ pinned: true }), { columnCount: 1, columnWidth: COLUMN_WIDTH })).toEqual({ colSpan: 1, rowSpan: 1 });
  });

  it("features pinned memos as hero tiles", () => {
    expect(bentoSpan(buildMemo({ pinned: true }), { columnCount: 3, columnWidth: COLUMN_WIDTH })).toEqual({ colSpan: 2, rowSpan: 2 });
  });

  it("features memos with a stored link cover", () => {
    const memo = create(MemoSchema, {
      name: "memos/link",
      property: { links: [{ url: "https://example.com", coverAttachmentUid: "abc123" }] },
    });
    expect(isFeaturedMemo(memo)).toBe(true);
    expect(bentoSpan(memo, { columnCount: 2, columnWidth: COLUMN_WIDTH }).colSpan).toBe(2);
  });

  it("features memos with image or video attachments", () => {
    const memo = buildMemo({ attachments: [buildAttachment({ filename: "photo.jpg", type: "image/jpeg" })] });
    expect(isFeaturedMemo(memo)).toBe(true);
  });

  it("does not feature memos with only document attachments", () => {
    const memo = buildMemo({ attachments: [buildAttachment({ filename: "doc.pdf", type: "application/pdf" })] });
    expect(isFeaturedMemo(memo)).toBe(false);
    expect(bentoSpan(memo, { columnCount: 3, columnWidth: COLUMN_WIDTH })).toEqual({ colSpan: 1, rowSpan: 1 });
  });

  it("grows rowSpan with estimated content height and caps it at 3", () => {
    const shortMemo = buildMemo({ content: "one line" });
    const tallMemo = buildMemo({ content: "line\n".repeat(120) });
    const shortRows = bentoSpan(shortMemo, { columnCount: 3, columnWidth: COLUMN_WIDTH }).rowSpan;
    const tallRows = bentoSpan(tallMemo, { columnCount: 3, columnWidth: COLUMN_WIDTH }).rowSpan;
    expect(tallRows).toBeGreaterThan(shortRows);
    expect(tallRows).toBeLessThanOrEqual(3);

    // The compact clamp bounds text-only cards, so assert the ceiling with a tiny row unit.
    expect(bentoSpan(tallMemo, { columnCount: 3, columnWidth: COLUMN_WIDTH, rowUnit: 100 }).rowSpan).toBe(3);
  });

  it("respects a custom row unit", () => {
    const memo = buildMemo({ content: "line\n".repeat(120) });
    const defaultRows = bentoSpan(memo, { columnCount: 3, columnWidth: COLUMN_WIDTH }).rowSpan;
    const halfUnitRows = bentoSpan(memo, { columnCount: 3, columnWidth: COLUMN_WIDTH, rowUnit: BENTO_ROW_UNIT / 2 }).rowSpan;
    expect(halfUnitRows).toBeGreaterThanOrEqual(defaultRows);
  });
});
