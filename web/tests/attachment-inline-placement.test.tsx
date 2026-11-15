import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import AttachmentListEditor from "@/components/MemoMetadata/Attachment/AttachmentListEditor";
import { AttachmentSchema } from "@/types/proto/api/attachment_service_pb";

const image = create(AttachmentSchema, {
  name: "attachments/photo",
  filename: "photo.png",
  type: "image/png",
  size: 128n,
});

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
});

describe("attachment inline placement actions", () => {
  it("offers insertion for an attachment-only image", () => {
    const onInsertAttachments = vi.fn();
    render(
      <AttachmentListEditor
        attachments={[image]}
        inlineAttachmentUIDs={new Set()}
        onAttachmentsChange={vi.fn()}
        onInsertAttachments={onInsertAttachments}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Insert image" }));
    expect(onInsertAttachments).toHaveBeenCalledWith([image]);
    expect(screen.getByRole("button", { name: "Remove attachment" })).toBeInTheDocument();
  });

  it("hides an inline image and restores it after its Markdown reference is removed", () => {
    const props = {
      attachments: [image],
      onAttachmentsChange: vi.fn(),
    };
    const { rerender } = render(<AttachmentListEditor {...props} inlineAttachmentUIDs={new Set(["photo"])} />);

    expect(screen.queryByRole("button", { name: "Preview photo.png" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove attachment" })).not.toBeInTheDocument();

    rerender(<AttachmentListEditor {...props} inlineAttachmentUIDs={new Set()} />);

    expect(screen.getByRole("button", { name: "Preview photo.png" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove attachment" })).toBeInTheDocument();
  });

  it("keeps hidden inline attachments in the order when a visible one moves", () => {
    const second = create(AttachmentSchema, { ...image, name: "attachments/second", filename: "second.png" });
    const third = create(AttachmentSchema, { ...image, name: "attachments/third", filename: "third.png" });
    const onOrderChange = vi.fn();
    render(
      <AttachmentListEditor
        attachments={[image, second, third]}
        inlineAttachmentUIDs={new Set(["photo"])}
        onAttachmentsChange={vi.fn()}
        onOrderChange={onOrderChange}
      />,
    );

    // Alt + arrow moves a focused tile, so plain arrows still scroll.
    fireEvent.keyDown(screen.getByRole("button", { name: "Preview second.png" }), { key: "ArrowRight", altKey: true });
    expect(onOrderChange).toHaveBeenCalledWith(["attachments/photo", "attachments/third", "attachments/second"]);
  });

  it("puts a new file before a saved one in one order", () => {
    const second = create(AttachmentSchema, { ...image, name: "attachments/second", filename: "second.png" });
    const localImage = {
      file: new File(["image"], "local.png", { type: "image/png" }),
      previewUrl: "blob:local",
      origin: "upload" as const,
    };
    const onOrderChange = vi.fn();
    render(<AttachmentListEditor attachments={[image, second]} localFiles={[localImage]} onOrderChange={onOrderChange} />);

    fireEvent.keyDown(screen.getByRole("button", { name: "Preview local.png" }), { key: "ArrowLeft", altKey: true });
    expect(onOrderChange).toHaveBeenCalledWith(["attachments/photo", "blob:local", "attachments/second"]);
  });

  it("does not offer inline placement for external images", () => {
    render(
      <AttachmentListEditor
        attachments={[create(AttachmentSchema, { ...image, externalLink: "https://example.com/photo.png" })]}
        onAttachmentsChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Insert image" })).not.toBeInTheDocument();
  });

  it("shows local inline-upload status and prevents removal while uploading", () => {
    const localImage = {
      file: new File(["image"], "local.png", { type: "image/png" }),
      previewUrl: "blob:local",
      origin: "upload" as const,
    };
    render(
      <AttachmentListEditor
        attachments={[]}
        localFiles={[localImage]}
        uploadingLocalFileURLs={new Set([localImage.previewUrl])}
        onLocalFilesChange={vi.fn()}
        onInsertLocalFiles={vi.fn()}
        placementActionsDisabled
      />,
    );

    expect(screen.getByRole("status", { name: "Uploading to content" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Insert image" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Remove attachment" })).not.toBeInTheDocument();
  });
});
