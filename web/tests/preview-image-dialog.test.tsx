import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PreviewImageDialog from "@/components/PreviewImageDialog";
import {
  AttachmentSchema,
  MediaCaptureTimeSchema,
  MediaLocationSchema,
  MediaMetadataSchema,
  PhotoMetadataSchema,
} from "@/types/proto/api/v1/attachment_service_pb";

vi.mock("@/hooks/useMediaQuery", () => ({
  __esModule: true,
  default: () => false,
}));

vi.mock("@/components/map/LazyLocationPicker", () => ({
  LazyLocationPicker: () => <div data-testid="attachment-location-map" />,
}));

const labels: Record<string, string> = {
  "attachment-details.actions.hide": "Hide attachment details",
  "attachment-details.actions.hide-map": "Hide map",
  "attachment-details.actions.show": "Show attachment details",
  "attachment-details.actions.show-map": "Show map",
  "attachment-details.empty": "No saved capture metadata.",
  "attachment-details.fields.altitude": "Altitude",
  "attachment-details.fields.camera": "Camera",
  "attachment-details.fields.captured": "Captured",
  "attachment-details.fields.dimensions": "Dimensions",
  "attachment-details.fields.exposure": "Exposure",
  "attachment-details.fields.file": "File",
  "attachment-details.fields.lens": "Lens",
  "attachment-details.fields.location": "Coordinates",
  "attachment-details.sections.camera": "Camera",
  "attachment-details.sections.capture": "Capture",
  "attachment-details.sections.file": "File",
  "attachment-details.sections.location": "Location",
  "attachment-details.timezone-unknown": "Time zone unknown",
  "attachment-details.title": "Details",
};

vi.mock("@/utils/i18n", () => ({
  findNearestMatchedLanguage: (language: string) => language || "en",
  useTranslate: () => (key: string) => labels[key] ?? key,
}));

const buildAttachmentWithPhotoMetadata = () =>
  create(AttachmentSchema, {
    name: "attachments/photo-1",
    filename: "photo.jpg",
    type: "image/jpeg",
    size: 4_200_000n,
    mediaMetadata: create(MediaMetadataSchema, {
      width: 4032,
      height: 3024,
      details: {
        case: "photo",
        value: create(PhotoMetadataSchema, {
          captureTime: create(MediaCaptureTimeSchema, { localDateTime: "2026-08-10T14:32:18" }),
          location: create(MediaLocationSchema, { latitude: 1.3521, longitude: 103.8198, altitudeMeters: 18.4 }),
          sourceExifOrientation: 6,
          cameraMake: "Apple",
          cameraModel: "iPhone",
          lensModel: "Main Camera",
          fNumber: 1.78,
          exposureTimeSeconds: 1 / 120,
          iso: 64,
          focalLengthMm: 6.86,
        }),
      },
    }),
  });

describe("<PreviewImageDialog>", () => {
  it("provides a dialog description without accessibility warnings", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[{ id: "image-1", kind: "image", sourceUrl: "/image.jpg", posterUrl: "/image.jpg", filename: "image.jpg" }]}
      />,
    );

    await waitFor(() => {
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("Missing `Description`"));
    });
  });

  it("keeps hook order stable when preview items appear after an empty render", () => {
    const { rerender } = render(<PreviewImageDialog open onOpenChange={vi.fn()} items={[]} />);

    expect(() => {
      rerender(
        <PreviewImageDialog
          open
          onOpenChange={vi.fn()}
          items={[{ id: "image-1", kind: "image", sourceUrl: "/image.jpg", posterUrl: "/image.jpg", filename: "image.jpg" }]}
        />,
      );
    }).not.toThrow();

    expect(screen.getByAltText("Preview image 1 of 1")).toBeInTheDocument();
  });

  it("shows zoom controls for image previews", () => {
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[{ id: "image-1", kind: "image", sourceUrl: "/image.jpg", posterUrl: "/image.jpg", filename: "image.jpg" }]}
      />,
    );

    expect(screen.getByRole("button", { name: /zoom in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zoom out/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset zoom/i })).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("toggles image zoom on double click", () => {
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[{ id: "image-1", kind: "image", sourceUrl: "/image.jpg", posterUrl: "/image.jpg", filename: "image.jpg" }]}
      />,
    );

    const image = screen.getByAltText("Preview image 1 of 1");

    fireEvent.doubleClick(image);

    expect(image).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(2)" });
    expect(screen.getByText("200%")).toBeInTheDocument();
  });

  it("zooms image previews with the wheel", () => {
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[{ id: "image-1", kind: "image", sourceUrl: "/image.jpg", posterUrl: "/image.jpg", filename: "image.jpg" }]}
      />,
    );

    fireEvent.wheel(screen.getByTestId("preview-zoom-surface"), { deltaY: -100 });

    expect(screen.getByText("120%")).toBeInTheDocument();
  });

  it("does not show zoom controls for video previews", () => {
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[{ id: "video-1", kind: "video", sourceUrl: "/video.mp4", posterUrl: "/poster.jpg", filename: "video.mp4" }]}
      />,
    );

    expect(screen.queryByRole("button", { name: /zoom in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /zoom out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reset zoom/i })).not.toBeInTheDocument();
  });

  it("keeps previous and next controls available for mobile image galleries", () => {
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[
          { id: "image-1", kind: "image", sourceUrl: "/image-1.jpg", posterUrl: "/image-1.jpg", filename: "image-1.jpg" },
          { id: "image-2", kind: "image", sourceUrl: "/image-2.jpg", posterUrl: "/image-2.jpg", filename: "image-2.jpg" },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: /previous item/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next item/i })).toBeInTheDocument();
  });

  it("shows saved media details on demand with grouped, lean facts", () => {
    const attachment = buildAttachmentWithPhotoMetadata();
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[
          {
            id: attachment.name,
            kind: "image",
            sourceUrl: "/image.jpg",
            posterUrl: "/image.jpg",
            filename: attachment.filename,
            attachments: [attachment],
          },
        ]}
      />,
    );

    expect(screen.queryByText("4032 × 3024 px")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show attachment details" }));

    expect(screen.getByText("4032 × 3024 px")).toBeInTheDocument();
    expect(screen.getByText("Apple iPhone")).toBeInTheDocument();
    expect(screen.getByText("ƒ/1.78 · 1/120 s · ISO 64 · 6.86 mm")).toBeInTheDocument();
    expect(screen.getByText("1.35210°, 103.81980°")).toBeInTheDocument();
    expect(screen.getByText("Time zone unknown")).toBeInTheDocument();
  });

  it("loads the attachment map only after an explicit action", () => {
    const attachment = buildAttachmentWithPhotoMetadata();
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[
          {
            id: attachment.name,
            kind: "image",
            sourceUrl: "/image.jpg",
            filename: attachment.filename,
            attachments: [attachment],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show attachment details" }));
    expect(screen.queryByTestId("attachment-location-map")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show map" }));
    expect(screen.getByTestId("attachment-location-map")).toBeInTheDocument();
  });

  it("closes details before closing the media dialog with Escape", async () => {
    const onOpenChange = vi.fn();
    render(
      <PreviewImageDialog
        open
        onOpenChange={onOpenChange}
        items={[{ id: "image-1", kind: "image", sourceUrl: "/image.jpg", filename: "image.jpg" }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show attachment details" }));
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByLabelText("Details")).not.toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
