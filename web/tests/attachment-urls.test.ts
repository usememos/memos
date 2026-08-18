import { describe, expect, it } from "vitest";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentMotionClipUrl, getAttachmentThumbnailUrl, getAttachmentUrl } from "@/utils/attachment";

const origin = window.location.origin;

const baseAttachment = {
  name: "attachments/test-uid",
  filename: "photo.png",
  type: "image/png",
} as Attachment;

// Regression tests for #6128: share-mode thumbnails/motion clips must keep the share token on externalLink.
describe("attachment URL builders in share mode", () => {
  it("appends thumbnail=true to an externalLink that carries a share token", () => {
    const attachment = {
      ...baseAttachment,
      externalLink: `${origin}/file/attachments/test-uid/photo.png?share_token=abc123`,
    } as Attachment;

    const url = new URL(getAttachmentThumbnailUrl(attachment));
    expect(url.searchParams.get("thumbnail")).toBe("true");
    expect(url.searchParams.get("share_token")).toBe("abc123");
  });

  it("appends motion=true to an externalLink that carries a share token", () => {
    const attachment = {
      ...baseAttachment,
      externalLink: `${origin}/file/attachments/test-uid/photo.png?share_token=abc123`,
    } as Attachment;

    const url = new URL(getAttachmentMotionClipUrl(attachment));
    expect(url.searchParams.get("motion")).toBe("true");
    expect(url.searchParams.get("share_token")).toBe("abc123");
  });

  it("keeps the server thumbnail URL when externalLink has no share token", () => {
    const attachment = {
      ...baseAttachment,
      externalLink: "https://cdn.example.com/photo.png?version=xyz",
    } as Attachment;

    expect(getAttachmentThumbnailUrl(attachment)).toBe(`${origin}/file/attachments/test-uid/photo.png?thumbnail=true`);
  });

  it("keeps the server thumbnail URL when no externalLink is set", () => {
    expect(getAttachmentThumbnailUrl(baseAttachment)).toBe(`${origin}/file/attachments/test-uid/photo.png?thumbnail=true`);
  });

  it("leaves getAttachmentUrl returning the externalLink verbatim", () => {
    const attachment = {
      ...baseAttachment,
      externalLink: `${origin}/file/attachments/test-uid/photo.png?share_token=abc123`,
    } as Attachment;

    expect(getAttachmentUrl(attachment)).toBe(attachment.externalLink);
  });
});
