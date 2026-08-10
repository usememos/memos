import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { pairAppleLivePhotoFiles } from "@/components/MemoEditor/hooks";
import { splitInlineLocalFiles } from "@/components/MemoEditor/hooks/useInlineImageUpload";
import type { LocalFile } from "@/components/MemoEditor/types/attachment";
import { MotionMediaRole } from "@/types/proto/api/v1/attachment_service_pb";

const localFile = (name: string, type: string): LocalFile => ({
  file: new File([name], name, { type }),
  previewUrl: `blob:${name}`,
  origin: "upload",
});

describe("inline image file routing", () => {
  it("routes images inline and keeps non-images as attachments", () => {
    const image = localFile("photo.png", "image/png");
    const document = localFile("notes.pdf", "application/pdf");
    expect(splitInlineLocalFiles([image, document])).toMatchObject({
      inline: [image],
      representativeIndexes: [0],
      attachments: [document],
    });
  });

  it("keeps both halves of an Apple Live Photo in the inline upload", () => {
    const still = localFile("IMG_0001.HEIC", "image/heic");
    const video = localFile("IMG_0001.MOV", "video/quicktime");
    const paired = pairAppleLivePhotoFiles([still, video]);
    const result = splitInlineLocalFiles(paired);

    expect(result.inline).toHaveLength(2);
    expect(result.attachments).toHaveLength(0);
    expect(result.inline.map((file) => file.motionMedia?.role)).toEqual([MotionMediaRole.STILL, MotionMediaRole.VIDEO]);
    // The still is what the inline Markdown reference is written for.
    expect(result.representativeIndexes).toEqual([0]);
  });

  it("does not treat PSD files as renderable inline images", () => {
    const psd = localFile("design.psd", "image/vnd.adobe.photoshop");
    expect(splitInlineLocalFiles([psd])).toMatchObject({ inline: [], representativeIndexes: [], attachments: [psd] });
  });
});
