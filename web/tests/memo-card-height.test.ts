import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { estimateMemoCardHeight } from "@/components/PagedMemoList/memoCardHeight";
import { AttachmentSchema } from "@/types/proto/api/attachment_service_pb";
import { MemoSchema } from "@/types/proto/api/memo_service_pb";

const buildAttachment = (overrides: MessageInitShape<typeof AttachmentSchema>) =>
  create(AttachmentSchema, {
    name: "attachments/test",
    filename: "test.bin",
    type: "application/octet-stream",
    ...overrides,
  });

const buildMemo = (overrides: MessageInitShape<typeof MemoSchema> = {}) =>
  create(MemoSchema, {
    name: "memos/main",
    content: "hello",
    attachments: [],
    relations: [],
    ...overrides,
  });

describe("estimateMemoCardHeight", () => {
  it("accounts for visual attachments before images have loaded", () => {
    const plain = buildMemo();
    const withImage = buildMemo({
      attachments: [
        buildAttachment({
          name: "attachments/image",
          filename: "image.png",
          type: "image/png",
        }),
      ],
    });

    expect(estimateMemoCardHeight(withImage, { columnWidth: 320 })).toBeGreaterThan(
      estimateMemoCardHeight(plain, { columnWidth: 320 }) + 100,
    );
  });

  it("does not count an inline managed image again as an attachment gallery", () => {
    const image = buildAttachment({ name: "attachments/image", filename: "image.png", type: "image/png" });
    const inline = buildMemo({ content: "![image](/file/attachments/image)", attachments: [image] });
    const external = buildMemo({ content: "![image](https://example.com/image.png)", attachments: [image] });

    expect(estimateMemoCardHeight(inline, { columnWidth: 320 })).toBeLessThan(estimateMemoCardHeight(external, { columnWidth: 320 }));
  });

  it("estimates the visible comment preview height and caps it at three comments", () => {
    const oneComment = buildMemo({ commentCount: 1 });
    const threeComments = buildMemo({ commentCount: 3 });
    const fiveComments = buildMemo({ commentCount: 5 });

    expect(estimateMemoCardHeight(threeComments, { columnWidth: 320 })).toBeGreaterThan(
      estimateMemoCardHeight(oneComment, { columnWidth: 320 }),
    );
    expect(estimateMemoCardHeight(fiveComments, { columnWidth: 320 })).toBe(estimateMemoCardHeight(threeComments, { columnWidth: 320 }));
  });

  it("reserves one strip row when the comment preview is collapsed or the card is a comment", () => {
    const plain = estimateMemoCardHeight(buildMemo(), { columnWidth: 320 });
    const collapsed = (commentCount: number) =>
      estimateMemoCardHeight(buildMemo({ commentCount }), { columnWidth: 320, commentsCollapsed: true });

    // While the list holds the comments themselves, a memo shows a single "View N comments" row.
    expect(collapsed(5)).toBe(plain + 33);
    expect(collapsed(1)).toBe(collapsed(5));
    expect(collapsed(0)).toBe(plain);
    expect(collapsed(5)).toBeLessThan(estimateMemoCardHeight(buildMemo({ commentCount: 5 }), { columnWidth: 320 }));

    // A comment's card carries its parent strip, and no preview of its own replies.
    expect(estimateMemoCardHeight(buildMemo({ parent: "memos/parent", commentCount: 4 }), { columnWidth: 320 })).toBe(plain + 33);
  });
});
