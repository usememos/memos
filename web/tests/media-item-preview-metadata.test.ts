import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { AttachmentSchema, MediaMetadataSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { buildAttachmentVisualItems } from "@/utils/media-item";

describe("media preview metadata plumbing", () => {
  it("keeps the source attachment on preview items", () => {
    const attachment = create(AttachmentSchema, {
      name: "attachments/photo",
      filename: "photo.jpg",
      type: "image/jpeg",
      mediaMetadata: create(MediaMetadataSchema, { width: 1200, height: 800 }),
    });

    const [item] = buildAttachmentVisualItems([attachment]);

    expect(item.previewItem.attachments).toEqual([attachment]);
  });
});
