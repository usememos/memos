import { create } from "@bufbuild/protobuf";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttachmentGallery } from "@/components/MemoMetadata/Attachment/AttachmentListView";
import { DRAWING_SHEET_TILE_CLASS, VISUAL_TILE_BUTTON_CLASS } from "@/components/MemoMetadata/Attachment/attachmentVisualClasses";
import { AttachmentSchema } from "@/types/proto/api/attachment_service_pb";

const image = (name: string, filename: string) => create(AttachmentSchema, { name: `attachments/${name}`, filename, type: "image/png" });
const classesOf = (value: string) => value.split(" ").filter(Boolean);

describe("drawings in the memo gallery", () => {
  it("shows a drawing as a sheet of paper and a photo in its framed tile", () => {
    render(
      <AttachmentGallery visual={[image("d", "drawing-20261106-101500.canvas.png"), image("p", "beach.png")]} onImagePreview={vi.fn()} />,
    );

    const drawing = screen.getByRole("button", { name: "drawing-20261106-101500.canvas.png" });
    const photo = screen.getByRole("button", { name: "beach.png" });
    expect(drawing).toHaveClass(...classesOf(DRAWING_SHEET_TILE_CLASS));
    expect(drawing).not.toHaveClass("border");
    expect(photo).toHaveClass(...classesOf(VISUAL_TILE_BUTTON_CLASS));
  });

  it("shows a single drawing as a sheet too", () => {
    render(<AttachmentGallery visual={[image("d", "drawing-20261106-101500.canvas.png")]} onImagePreview={vi.fn()} />);

    expect(screen.getByRole("button", { name: "drawing-20261106-101500.canvas.png" })).toHaveClass("shadow-mu-raised");
  });
});
