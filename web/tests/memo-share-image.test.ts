import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import {
  buildMemoShareImageFileName,
  getMemoShareDialogWidth,
  getMemoSharePreviewAvatarUrl,
  getMemoSharePreviewWidth,
  getMemoShareRenderWidth,
} from "@/components/MemoActionMenu/memoShareImage";
import { buildMemoShareImagePreviewModel } from "@/components/MemoActionMenu/memoShareImagePreviewModel";
import { AttachmentSchema, type Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { MemoSchema, type Memo } from "@/types/proto/api/v1/memo_service_pb";

const buildMemo = (overrides: Partial<Memo> = {}) =>
  create(MemoSchema, {
    name: "memos/test",
    content: "hello",
    tags: [],
    attachments: [],
    ...overrides,
  });

const buildAttachment = (overrides: Partial<Attachment>) =>
  create(AttachmentSchema, {
    name: "attachments/test",
    filename: "test.bin",
    type: "application/octet-stream",
    ...overrides,
  });

const buildPreviewModel = (memo: Memo) =>
  buildMemoShareImagePreviewModel({
    memo,
    fallbackDisplayName: "Memo",
    locale: "en-US",
  });

describe("memo share image preview model", () => {
  it("does not create footer chips for memo tags already rendered in content", () => {
    const memo = buildMemo({
      content: "Investigate #bug",
      tags: ["bug"],
    });

    const model = buildPreviewModel(memo);

    expect(model.footerBadges).toEqual([]);
  });

  it("keeps non-visual attachments visible as a footer summary", () => {
    const memo = buildMemo({
      attachments: [
        buildAttachment({
          name: "attachments/doc",
          filename: "doc.pdf",
          type: "application/pdf",
        }),
      ],
    });

    const model = buildPreviewModel(memo);

    expect(model.visualItems).toEqual([]);
    expect(model.footerBadges).toEqual([{ type: "attachment-summary", count: 1 }]);
  });

  it("keeps visual attachments in the media grid without adding a footer summary", () => {
    const memo = buildMemo({
      attachments: [
        buildAttachment({
          name: "attachments/image",
          filename: "image.png",
          type: "image/png",
        }),
      ],
    });

    const model = buildPreviewModel(memo);

    expect(model.visualItems).toHaveLength(1);
    expect(model.visualItems[0]?.posterUrl).toContain("/file/attachments/image/image.png?thumbnail=true");
    expect(model.footerBadges).toEqual([]);
  });

  it("counts mixed visual and non-visual attachments in the summary", () => {
    const memo = buildMemo({
      attachments: [
        buildAttachment({
          name: "attachments/image",
          filename: "image.png",
          type: "image/png",
        }),
        buildAttachment({
          name: "attachments/archive",
          filename: "archive.zip",
          type: "application/zip",
        }),
      ],
    });

    const model = buildPreviewModel(memo);

    expect(model.visualItems).toHaveLength(1);
    expect(model.footerBadges).toEqual([{ type: "attachment-summary", count: 2 }]);
  });
});

describe("memo share image utilities", () => {
  it("builds filenames from memo resource names", () => {
    expect(buildMemoShareImageFileName("memos/abc123")).toBe("memo-abc123.png");
    expect(buildMemoShareImageFileName("")).toBe("memo-memo.png");
  });

  it("clamps preview and dialog widths", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });

    expect(getMemoSharePreviewWidth(100)).toBe(260);
    expect(getMemoSharePreviewWidth(800)).toBe(520);
    expect(getMemoShareDialogWidth(520)).toBe(600);
    expect(getMemoShareRenderWidth(520, 600)).toBe(560);
  });

  it("uses the viewport when no card width is available", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 400 });

    expect(getMemoSharePreviewWidth(0)).toBe(317);
  });

  it("keeps only exportable avatar URLs", () => {
    expect(getMemoSharePreviewAvatarUrl("/avatars/a.png")).toBe("/avatars/a.png");
    expect(getMemoSharePreviewAvatarUrl("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
    expect(getMemoSharePreviewAvatarUrl("https://example.com/avatar.png")).toBeUndefined();
  });
});
