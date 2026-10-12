import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PreviewImageDialog from "@/components/PreviewImageDialog";
import {
  AttachmentSchema,
  MediaCaptureTimeSchema,
  MediaLocationSchema,
  MediaMetadataSchema,
  PhotoMetadataSchema,
} from "@/types/proto/api/attachment_service_pb";

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

// jsdom has no layout engine, so pan bounds need explicit image and surface sizes.
const mockPreviewLayout = (image: { width: number; height: number }, surface: { width: number; height: number }) => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(image.width);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(image.height);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(surface.width);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(surface.height);
};

// The pinch anchor is measured from the image's layout center, which the untransformed wrapper reports.
const mockImageCenter = (image: HTMLElement, x: number, y: number) => {
  const wrapper = image.parentElement as HTMLElement;
  vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue({
    x: x - 200,
    y: y - 150,
    left: x - 200,
    top: y - 150,
    right: x + 200,
    bottom: y + 150,
    width: 400,
    height: 300,
    toJSON: () => ({}),
  } as DOMRect);
};

describe("<PreviewImageDialog>", () => {
  beforeEach(() => {
    // jsdom ships PointerEvent but not pointer capture: stub the capture methods.
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => true);
    Element.prototype.releasePointerCapture = vi.fn();
  });

  afterEach(() => {
    // Prototype assignments outlive `restoreMocks`, so drop them explicitly.
    for (const method of ["setPointerCapture", "hasPointerCapture", "releasePointerCapture"]) {
      Reflect.deleteProperty(Element.prototype, method);
    }
  });
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

  it("pans a zoomed image with a pointer drag", () => {
    mockPreviewLayout({ width: 1200, height: 800 }, { width: 600, height: 600 });
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[{ id: "image-1", kind: "image", sourceUrl: "/image.jpg", posterUrl: "/image.jpg", filename: "image.jpg" }]}
      />,
    );

    const image = screen.getByAltText("Preview image 1 of 1");
    fireEvent.doubleClick(image);
    fireEvent.pointerDown(image, { button: 0, pointerId: 1, clientX: 100, clientY: 120 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 180, clientY: 160 });
    fireEvent.pointerUp(image, { pointerId: 1, clientX: 180, clientY: 160 });

    expect(image).toHaveStyle({ transform: "translate3d(80px, 40px, 0) scale(2)" });
  });

  it("clamps the pan to the enlarged image bounds", () => {
    mockPreviewLayout({ width: 1200, height: 800 }, { width: 600, height: 600 });
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[{ id: "image-1", kind: "image", sourceUrl: "/image.jpg", posterUrl: "/image.jpg", filename: "image.jpg" }]}
      />,
    );

    const image = screen.getByAltText("Preview image 1 of 1");
    fireEvent.doubleClick(image);
    fireEvent.pointerDown(image, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 100000, clientY: 100000 });
    fireEvent.pointerUp(image, { pointerId: 1, clientX: 100000, clientY: 100000 });

    expect(image).toHaveStyle({ transform: "translate3d(900px, 500px, 0) scale(2)" });
  });

  it("clamps the pan to the padded content area", () => {
    mockPreviewLayout({ width: 1200, height: 800 }, { width: 600, height: 600 });
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[{ id: "image-1", kind: "image", sourceUrl: "/image.jpg", posterUrl: "/image.jpg", filename: "image.jpg" }]}
      />,
    );

    const surface = screen.getByTestId("preview-zoom-surface");
    surface.style.paddingBottom = "80px";
    surface.style.paddingLeft = "64px";
    surface.style.paddingRight = "416px";
    const image = screen.getByAltText("Preview image 1 of 1");
    fireEvent.doubleClick(image);
    fireEvent.pointerDown(image, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 100000, clientY: 100000 });
    fireEvent.pointerUp(image, { pointerId: 1, clientX: 100000, clientY: 100000 });

    expect(image).toHaveStyle({ transform: "translate3d(1140px, 540px, 0) scale(2)" });
  });

  it("does not pan an image that sits at fit zoom", () => {
    mockPreviewLayout({ width: 1200, height: 800 }, { width: 600, height: 600 });
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[{ id: "image-1", kind: "image", sourceUrl: "/image.jpg", posterUrl: "/image.jpg", filename: "image.jpg" }]}
      />,
    );

    const image = screen.getByAltText("Preview image 1 of 1");
    fireEvent.pointerDown(image, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 200, clientY: 200 });

    expect(image).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(1)" });
  });

  it("drops the pan when the zoom returns to fit", () => {
    mockPreviewLayout({ width: 1200, height: 800 }, { width: 600, height: 600 });
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[{ id: "image-1", kind: "image", sourceUrl: "/image.jpg", posterUrl: "/image.jpg", filename: "image.jpg" }]}
      />,
    );

    const image = screen.getByAltText("Preview image 1 of 1");
    fireEvent.doubleClick(image);
    fireEvent.pointerDown(image, { button: 0, pointerId: 1, clientX: 100, clientY: 120 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 180, clientY: 160 });
    fireEvent.pointerUp(image, { pointerId: 1, clientX: 180, clientY: 160 });

    fireEvent.click(screen.getByRole("button", { name: /reset zoom/i }));

    expect(image).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(1)" });
  });

  it("resets the pan when switching to another item", () => {
    mockPreviewLayout({ width: 1200, height: 800 }, { width: 600, height: 600 });
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

    const firstImage = screen.getByAltText("Preview image 1 of 2");
    fireEvent.doubleClick(firstImage);
    fireEvent.pointerDown(firstImage, { button: 0, pointerId: 1, clientX: 100, clientY: 120 });
    fireEvent.pointerMove(firstImage, { pointerId: 1, clientX: 180, clientY: 160 });

    fireEvent.click(screen.getByRole("button", { name: /next item/i }));

    expect(screen.getByAltText("Preview image 2 of 2")).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(1)" });
  });

  it("clears a stale drag when the item changes", () => {
    mockPreviewLayout({ width: 1200, height: 800 }, { width: 600, height: 600 });
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[
          { id: "image-1", kind: "image", sourceUrl: "/image-1.jpg", posterUrl: "/image-1.jpg", filename: "image-1.jpg" },
          { id: "video-1", kind: "video", sourceUrl: "/video.mp4", posterUrl: "/poster.jpg", filename: "video.mp4" },
        ]}
      />,
    );

    const image = screen.getByAltText("Preview image 1 of 2");
    fireEvent.doubleClick(image);
    fireEvent.pointerDown(image, { button: 0, pointerId: 1, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 200, clientY: 300 });
    expect(image).toHaveStyle({ transform: "translate3d(-100px, 0px, 0) scale(2)" });

    fireEvent.keyDown(document, { key: "ArrowRight" });
    fireEvent.keyDown(document, { key: "ArrowLeft" });

    const returned = screen.getByAltText("Preview image 1 of 2");
    fireEvent.doubleClick(returned);
    fireEvent.pointerMove(returned, { pointerId: 1, clientX: 220, clientY: 300 });

    expect(returned).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(2)" });
  });

  it("zooms about the gesture midpoint with a two-finger pinch", () => {
    mockPreviewLayout({ width: 1200, height: 800 }, { width: 600, height: 600 });
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[{ id: "image-1", kind: "image", sourceUrl: "/image.jpg", posterUrl: "/image.jpg", filename: "image.jpg" }]}
      />,
    );

    const image = screen.getByAltText("Preview image 1 of 1");
    mockImageCenter(image, 300, 300);
    fireEvent.pointerDown(image, { button: 0, pointerId: 1, clientX: 300, clientY: 300 });
    fireEvent.pointerDown(image, { button: 0, pointerId: 2, clientX: 400, clientY: 300 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 250, clientY: 300 });
    fireEvent.pointerMove(image, { pointerId: 2, clientX: 450, clientY: 300 });

    expect(image).toHaveStyle({ transform: "translate3d(-50px, 0px, 0) scale(2)" });
    expect(screen.getByText("200%")).toBeInTheDocument();
  });

  it("keeps a pinch around the image center from drifting", () => {
    mockPreviewLayout({ width: 1200, height: 800 }, { width: 600, height: 600 });
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[{ id: "image-1", kind: "image", sourceUrl: "/image.jpg", posterUrl: "/image.jpg", filename: "image.jpg" }]}
      />,
    );

    const image = screen.getByAltText("Preview image 1 of 1");
    mockImageCenter(image, 300, 300);
    fireEvent.pointerDown(image, { button: 0, pointerId: 1, clientX: 250, clientY: 300 });
    fireEvent.pointerDown(image, { button: 0, pointerId: 2, clientX: 350, clientY: 300 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 200, clientY: 300 });
    fireEvent.pointerMove(image, { pointerId: 2, clientX: 400, clientY: 300 });

    expect(image).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(2)" });
  });

  it("clamps a pinch at fit zoom and drops the pan", () => {
    mockPreviewLayout({ width: 1200, height: 800 }, { width: 600, height: 600 });
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[{ id: "image-1", kind: "image", sourceUrl: "/image.jpg", posterUrl: "/image.jpg", filename: "image.jpg" }]}
      />,
    );

    const image = screen.getByAltText("Preview image 1 of 1");
    fireEvent.doubleClick(image);
    fireEvent.pointerDown(image, { button: 0, pointerId: 1, clientX: 100, clientY: 120 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 180, clientY: 160 });
    fireEvent.pointerUp(image, { pointerId: 1, clientX: 180, clientY: 160 });
    expect(image).toHaveStyle({ transform: "translate3d(80px, 40px, 0) scale(2)" });

    fireEvent.pointerDown(image, { button: 0, pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(image, { button: 0, pointerId: 3, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(image, { pointerId: 2, clientX: 190, clientY: 190 });
    fireEvent.pointerMove(image, { pointerId: 3, clientX: 210, clientY: 210 });

    expect(image).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(1)" });
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("keeps panning with the finger that stays after a pinch", () => {
    mockPreviewLayout({ width: 1200, height: 800 }, { width: 600, height: 600 });
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        items={[{ id: "image-1", kind: "image", sourceUrl: "/image.jpg", posterUrl: "/image.jpg", filename: "image.jpg" }]}
      />,
    );

    const image = screen.getByAltText("Preview image 1 of 1");
    mockImageCenter(image, 300, 300);
    fireEvent.pointerDown(image, { button: 0, pointerId: 1, clientX: 300, clientY: 300 });
    fireEvent.pointerDown(image, { button: 0, pointerId: 2, clientX: 400, clientY: 300 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 250, clientY: 300 });
    fireEvent.pointerMove(image, { pointerId: 2, clientX: 450, clientY: 300 });
    expect(image).toHaveStyle({ transform: "translate3d(-50px, 0px, 0) scale(2)" });

    fireEvent.pointerUp(image, { pointerId: 2, clientX: 450, clientY: 300 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 270, clientY: 300 });

    expect(image).toHaveStyle({ transform: "translate3d(-30px, 0px, 0) scale(2)" });
  });

  it("follows the finger and swipes to the next image in a gallery", () => {
    mockPreviewLayout({ width: 1200, height: 800 }, { width: 600, height: 600 });
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

    const image = screen.getByAltText("Preview image 1 of 2");
    fireEvent.pointerDown(image, { button: 0, pointerId: 1, clientX: 250, clientY: 300 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 150, clientY: 300 });
    expect(image).toHaveStyle({ transform: "translate3d(-100px, 0px, 0) scale(1)" });

    fireEvent.pointerUp(image, { pointerId: 1, clientX: 150, clientY: 300 });
    expect(screen.getByAltText("Preview image 2 of 2")).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(1)" });
  });

  it("swipes back to the previous image", () => {
    mockPreviewLayout({ width: 1200, height: 800 }, { width: 600, height: 600 });
    render(
      <PreviewImageDialog
        open
        onOpenChange={vi.fn()}
        initialIndex={1}
        items={[
          { id: "image-1", kind: "image", sourceUrl: "/image-1.jpg", posterUrl: "/image-1.jpg", filename: "image-1.jpg" },
          { id: "image-2", kind: "image", sourceUrl: "/image-2.jpg", posterUrl: "/image-2.jpg", filename: "image-2.jpg" },
        ]}
      />,
    );

    const image = screen.getByAltText("Preview image 2 of 2");
    fireEvent.pointerDown(image, { button: 0, pointerId: 1, clientX: 150, clientY: 300 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 250, clientY: 300 });
    fireEvent.pointerUp(image, { pointerId: 1, clientX: 250, clientY: 300 });

    expect(screen.getByAltText("Preview image 1 of 2")).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(1)" });
  });

  it("ignores short and vertical drags in a gallery", () => {
    mockPreviewLayout({ width: 1200, height: 800 }, { width: 600, height: 600 });
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

    const image = screen.getByAltText("Preview image 1 of 2");
    fireEvent.pointerDown(image, { button: 0, pointerId: 1, clientX: 250, clientY: 300 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 220, clientY: 300 });
    fireEvent.pointerUp(image, { pointerId: 1, clientX: 220, clientY: 300 });
    expect(screen.getByAltText("Preview image 1 of 2")).toBeInTheDocument();

    fireEvent.pointerDown(image, { button: 0, pointerId: 2, clientX: 250, clientY: 300 });
    fireEvent.pointerMove(image, { pointerId: 2, clientX: 150, clientY: 400 });
    fireEvent.pointerUp(image, { pointerId: 2, clientX: 150, clientY: 400 });
    expect(screen.getByAltText("Preview image 1 of 2")).toBeInTheDocument();
  });

  it("ignores a cancelled swipe", () => {
    mockPreviewLayout({ width: 1200, height: 800 }, { width: 600, height: 600 });
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

    const image = screen.getByAltText("Preview image 1 of 2");
    fireEvent.pointerDown(image, { button: 0, pointerId: 1, clientX: 250, clientY: 300 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 150, clientY: 300 });
    fireEvent.pointerCancel(image, { pointerId: 1, clientX: 150, clientY: 300 });

    expect(screen.getByAltText("Preview image 1 of 2")).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(1)" });
  });

  it("pans a zoomed gallery instead of swiping", () => {
    mockPreviewLayout({ width: 1200, height: 800 }, { width: 600, height: 600 });
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

    const image = screen.getByAltText("Preview image 1 of 2");
    fireEvent.doubleClick(image);
    fireEvent.pointerDown(image, { button: 0, pointerId: 1, clientX: 250, clientY: 300 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 150, clientY: 300 });
    fireEvent.pointerUp(image, { pointerId: 1, clientX: 150, clientY: 300 });

    expect(screen.getByAltText("Preview image 1 of 2")).toHaveStyle({ transform: "translate3d(-100px, 0px, 0) scale(2)" });
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
