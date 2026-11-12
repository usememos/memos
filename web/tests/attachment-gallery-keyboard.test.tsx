import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttachmentGallery } from "@/components/MemoMetadata/Attachment/AttachmentListView";
import { AttachmentSchema } from "@/types/proto/api/attachment_service_pb";

const image = (name: string, filename: string) => create(AttachmentSchema, { name: `attachments/${name}`, filename, type: "image/png" });

describe("<AttachmentGallery> keyboard", () => {
  it("opens the viewer from a focused tile with Enter or Space", () => {
    const onImagePreview = vi.fn();
    render(<AttachmentGallery visual={[image("a", "beach.png"), image("b", "hills.png")]} onImagePreview={onImagePreview} />);

    const tile = screen.getByRole("button", { name: "hills.png" });
    expect(tile).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(tile, { key: "Enter" });
    expect(onImagePreview).toHaveBeenLastCalledWith(expect.any(Array), 1);
    fireEvent.keyDown(tile, { key: " " });
    expect(onImagePreview).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(tile, { key: "a" });
    expect(onImagePreview).toHaveBeenCalledTimes(2);
    // Keys meant for a control inside the tile stay with it.
    fireEvent.keyDown(screen.getByAltText("hills.png"), { key: "Enter" });
    expect(onImagePreview).toHaveBeenCalledTimes(2);
  });
});
