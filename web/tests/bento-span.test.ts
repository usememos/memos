import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { BENTO_ROW_UNIT, bentoSpan, isFeaturedMemo } from "@/components/BentoGrid/bentoSpan";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const buildAttachment = (overrides: MessageInitShape<typeof AttachmentSchema>) =>
  create(AttachmentSchema, { name: "attachments/test", filename: "test.bin", type: "application/octet-stream", ...overrides });

const buildMemo = (overrides: MessageInitShape<typeof MemoSchema> = {}) =>
  create(MemoSchema, { name: "memos/main", content: "hello", attachments: [], ...overrides });

const COLUMN_WIDTH = 320;

describe("bentoSpan", () => {
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
