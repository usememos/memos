import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttachmentGallery } from "@/components/MemoMetadata/Attachment/AttachmentListView";
import {
  DRAWING_SHEET_MEDIA_CLASS,
  DRAWING_SHEET_SINGLE_CLASS,
  VISUAL_TILE_BUTTON_CLASS,
} from "@/components/MemoMetadata/Attachment/attachmentVisualClasses";
import { AttachmentSchema } from "@/types/proto/api/attachment_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";

const image = (name: string, filename: string) => create(AttachmentSchema, { name: `attachments/${name}`, filename, type: "image/png" });
const classesOf = (value: string) => value.split(" ").filter(Boolean);

describe("drawings in the memo gallery", () => {
  it("frames a drawing in a collage like the photos beside it", () => {
    render(
      <AttachmentGallery visual={[image("d", "drawing-20261106-101500.canvas.png"), image("p", "beach.png")]} onImagePreview={vi.fn()} />,
    );

    // One grid, one edge: the drawing keeps its paper but takes the photos' hairline frame.
    const drawing = screen.getByRole("button", { name: "drawing-20261106-101500.canvas.png" });
    const photo = screen.getByRole("button", { name: "beach.png" });
    expect(drawing).toHaveClass(...classesOf(VISUAL_TILE_BUTTON_CLASS));
    expect(drawing).not.toHaveClass("shadow-mu-raised");
    expect(photo).toHaveClass(...classesOf(VISUAL_TILE_BUTTON_CLASS));
  });

  it("shows a lone drawing on a full-width sheet, at the size it was drawn", () => {
    const drawing = image("d", "drawing-20261106-101500.canvas.png");
    render(<AttachmentGallery visual={[drawing]} onImagePreview={vi.fn()} />);

    const sheet = screen.getByRole("button", { name: drawing.filename });
    expect(sheet).toHaveClass("shadow-mu-raised", ...classesOf(DRAWING_SHEET_SINGLE_CLASS));
    // The original file at 2x, not the thumbnail, so it shows at drawn size and stays sharp.
    const img = screen.getByRole("img", { name: drawing.filename });
    expect(img).toHaveAttribute("src", getAttachmentUrl(drawing));
    expect(img).toHaveAttribute("srcset", `${getAttachmentUrl(drawing)} 2x`);
    expect(img).toHaveClass(...classesOf(DRAWING_SHEET_MEDIA_CLASS));
  });

  it("extends the drawing's own paper, read from its corner pixel", () => {
    const drawing = image("d", "drawing-20261106-101500.canvas.png");
    const corner = vi.fn(() => ({ data: new Uint8ClampedArray([255, 255, 255, 255]) }));
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ drawImage: vi.fn(), getImageData: corner } as unknown as CanvasRenderingContext2D);
    render(<AttachmentGallery visual={[drawing]} onImagePreview={vi.fn()} />);

    const sheet = screen.getByRole("button", { name: drawing.filename });
    expect(sheet.style.background).toBe("rgb(251, 250, 247)");
    fireEvent.load(screen.getByRole("img", { name: drawing.filename }));
    expect(sheet.style.background).toBe("rgb(255, 255, 255)");
    getContext.mockRestore();
  });

  it("fits a drawing inside its collage cell instead of cropping it, without the photo hover", () => {
    const drawing = image("d", "drawing-20261106-101500.canvas.png");
    const { container } = render(<AttachmentGallery visual={[image("p", "beach.png"), drawing]} onImagePreview={vi.fn()} />);

    expect(screen.getByRole("img", { name: drawing.filename })).toHaveClass("object-contain");
    expect(screen.getByRole("img", { name: "beach.png" })).toHaveClass("object-cover");
    const sheet = screen.getByRole("button", { name: drawing.filename });
    expect(sheet.querySelector("[aria-hidden]")).toBeNull();
    expect(container.querySelectorAll("[aria-hidden]")).toHaveLength(1);
  });
});
