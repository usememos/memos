import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { buildAttachmentLibraryStats } from "@/hooks/useAttachmentLibrary";
import {
  AttachmentSchema,
  MotionMediaFamily,
  MotionMediaRole,
  MotionMediaSchema,
  type Attachment,
} from "@/types/proto/api/v1/attachment_service_pb";

const attachment = (name: string, type: string, memo?: string): Attachment =>
  create(AttachmentSchema, { name: `attachments/${name}`, filename: name, type, memo });

describe("buildAttachmentLibraryStats", () => {
  it("counts linked attachment types without expanding live-photo pairs", () => {
    const still = attachment("live.jpg", "image/jpeg", "memos/one");
    still.motionMedia = create(MotionMediaSchema, {
      family: MotionMediaFamily.APPLE_LIVE_PHOTO,
      role: MotionMediaRole.STILL,
      groupId: "live-photo",
    });
    const video = attachment("live.mov", "video/quicktime", "memos/one");
    video.motionMedia = create(MotionMediaSchema, {
      family: MotionMediaFamily.APPLE_LIVE_PHOTO,
      role: MotionMediaRole.VIDEO,
      groupId: "live-photo",
    });

    expect(
      buildAttachmentLibraryStats([
        still,
        video,
        attachment("photo.png", "image/png", "memos/one"),
        attachment("recording.mp3", "audio/mpeg", "memos/one"),
        attachment("notes.pdf", "application/pdf", "memos/one"),
        attachment("unused.png", "image/png"),
      ]),
    ).toEqual({
      unused: 1,
      media: 2,
      documents: 1,
      audio: 1,
    });
  });
});
