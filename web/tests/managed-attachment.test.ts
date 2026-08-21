import { create } from "@bufbuild/protobuf";
import { afterEach, describe, expect, it } from "vitest";
import { AttachmentSchema, MotionMediaFamily, MotionMediaRole, MotionMediaSchema } from "@/types/proto/api/v1/attachment_service_pb";
import {
  buildManagedAttachmentMarkdown,
  extractManagedAttachmentUIDs,
  filterInlineManagedAttachments,
  findInvalidManagedAttachmentReferences,
  parseManagedAttachmentImageURL,
  removeManagedAttachmentReferences,
  resolveManagedAttachmentImageSource,
  setManagedAttachmentInstanceUrl,
} from "@/utils/managed-attachment";

const attachment = (name: string, filename = "photo.png", externalLink = "") =>
  create(AttachmentSchema, { name, filename, type: "image/png", externalLink });

afterEach(() => setManagedAttachmentInstanceUrl(undefined));

describe("managed attachment Markdown", () => {
  it("builds canonical URLs and escapes filename alt text", () => {
    expect(buildManagedAttachmentMarkdown(attachment("attachments/image-one", "garden[west]\\view.png"))).toBe(
      "![garden\\[west\\]\\\\view](/file/attachments/image-one)",
    );
  });

  it("extracts canonical, legacy, and reference-style images", () => {
    const content = [
      "![one](/file/attachments/image-one)",
      "![two](/file/attachments/image-two/photo.png)",
      "![three][photo]",
      "[photo]: /file/attachments/image-three",
      "`![code](/file/attachments/code-image)`",
      "```md\n![fenced](/file/attachments/fenced-image)\n```",
    ].join("\n\n");

    expect(Array.from(extractManagedAttachmentUIDs(content))).toEqual(["image-one", "image-two", "image-three"]);
    expect(findInvalidManagedAttachmentReferences(content)).toEqual([]);
  });

  it("uses the first duplicate reference definition like Goldmark", () => {
    const content = ["![photo][asset]", "[asset]: /file/attachments/first-image", "[asset]: /file/attachments/second-image"].join("\n\n");

    expect(Array.from(extractManagedAttachmentUIDs(content))).toEqual(["first-image"]);
  });

  it("does not normalize path-relative images into managed attachment URLs", () => {
    const source = "file/attachments/image-one";

    expect(parseManagedAttachmentImageURL(source)).toBeUndefined();
    expect(extractManagedAttachmentUIDs(`![image](${source})`)).toEqual(new Set());
    expect(resolveManagedAttachmentImageSource(source, [attachment("attachments/image-one")])).toBe(source);
  });

  // The API matches absolute URLs against the configured instance URL, not the
  // browsing origin, and rejects them outright when no instance URL is set.
  it("resolves absolute images against the configured instance URL", () => {
    setManagedAttachmentInstanceUrl("https://memos.example.com");
    const content = [
      "![configured](https://memos.example.com/file/attachments/image-one)",
      `![browsing-host](${window.location.origin}/file/attachments/image-two)`,
      "![elsewhere](https://example.com/file/attachments/image-three)",
    ].join("\n\n");

    expect(Array.from(extractManagedAttachmentUIDs(content))).toEqual(["image-one"]);
    expect(findInvalidManagedAttachmentReferences(content)).toEqual([]);
  });

  // Matches the API, which errors on any absolute URL under the managed route
  // when it has no instance URL to compare against — whoever hosts it.
  it("rejects absolute images when no instance URL is configured", () => {
    const own = `${window.location.origin}/file/attachments/image-one`;
    const content = [`![own](${own})`, "![elsewhere](https://example.com/file/attachments/image-two)"].join("\n\n");

    expect(extractManagedAttachmentUIDs(content)).toEqual(new Set());
    expect(findInvalidManagedAttachmentReferences(content)).toEqual([own, "https://example.com/file/attachments/image-two"]);
  });

  it("reports raw HTML managed images as unsupported instead of ignoring them", () => {
    const raw = '<img src="/file/attachments/html-image">';

    expect(extractManagedAttachmentUIDs(raw)).toEqual(new Set());
    expect(findInvalidManagedAttachmentReferences(raw)).toEqual([raw]);
    // Code spans and fences are not raw HTML, so they stay out of the way.
    expect(findInvalidManagedAttachmentReferences('`<img src="/file/attachments/html-image">`')).toEqual([]);
  });

  it("rejects encoded, protocol-relative, queried, and malformed managed paths", () => {
    for (const url of [
      "/file/attachments/%69mage",
      "//localhost/file/attachments/image",
      "/file/attachments/image?token=x",
      "/file/attachments/image#fragment",
      "/file/attachments/image/",
      "/file/attachments/image/file/extra",
    ]) {
      expect(parseManagedAttachmentImageURL(url)).toBeUndefined();
      expect(findInvalidManagedAttachmentReferences(`![x](${url})`)).toEqual([url]);
    }
  });

  it("removes only matching image nodes and leaves code and other content intact", () => {
    const content = [
      "before",
      "",
      "![remove](/file/attachments/remove-me)",
      "",
      "keep ![other](/file/attachments/keep-me) here",
      "",
      "`![code](/file/attachments/remove-me)`",
    ].join("\n");

    expect(removeManagedAttachmentReferences(content, new Set(["remove-me"]))).toBe(
      ["before", "", "keep ![other](/file/attachments/keep-me) here", "", "`![code](/file/attachments/remove-me)`"].join("\n"),
    );
  });

  it("filters the entire motion group when its still image is inline", () => {
    const motion = create(MotionMediaSchema, {
      family: MotionMediaFamily.APPLE_LIVE_PHOTO,
      role: MotionMediaRole.STILL,
      groupId: "live-one",
    });
    const still = create(AttachmentSchema, { ...attachment("attachments/still"), motionMedia: motion });
    const video = create(AttachmentSchema, {
      name: "attachments/video",
      filename: "photo.mov",
      type: "video/quicktime",
      motionMedia: create(MotionMediaSchema, { ...motion, role: MotionMediaRole.VIDEO }),
    });
    const regular = attachment("attachments/regular");

    expect(filterInlineManagedAttachments("![still](/file/attachments/still)", [still, video, regular])).toEqual([regular]);
  });

  it("filters repeated references once and never hides an unrelated attachment", () => {
    const own = attachment("attachments/own");
    const content = [
      "![foreign](/file/attachments/someone-elses-image)",
      "![own](/file/attachments/own)",
      "![own again](/file/attachments/own)",
    ].join("\n\n");

    expect(filterInlineManagedAttachments(content, [own, attachment("attachments/unrelated")])).toEqual([
      attachment("attachments/unrelated"),
    ]);
  });

  it("resolves managed image sources through attachment metadata", () => {
    const shared = attachment("attachments/shared", "shared.png", `${window.location.origin}/file/attachments/shared?share_token=abc`);
    expect(resolveManagedAttachmentImageSource("/file/attachments/shared", [shared])).toBe(shared.externalLink);
    expect(resolveManagedAttachmentImageSource("https://example.com/image.png", [shared])).toBe("https://example.com/image.png");
  });
});
