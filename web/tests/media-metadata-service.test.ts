import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseExif: vi.fn(),
}));

vi.mock("exifr", () => ({
  parse: mocks.parseExif,
}));

import { mediaMetadataService } from "@/components/MemoEditor/services/mediaMetadataService";

describe("mediaMetadataService", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:test-media"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 640, height: 480, close: vi.fn() })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("normalizes selected EXIF fields without inventing a timezone", async () => {
    mocks.parseExif.mockResolvedValue({
      Make: " Apple\0 ",
      Model: "iPhone",
      LensModel: "Main Camera",
      Orientation: 6,
      ExifImageWidth: 4000,
      ExifImageHeight: 3000,
      DateTimeOriginal: "2026:08:10 14:32:18",
      SubSecTimeOriginal: "123",
      latitude: 1.3521,
      longitude: 103.8198,
      GPSAltitude: 18.4,
      GPSAltitudeRef: 0,
      FNumber: 1.78,
      ExposureTime: 1 / 120,
      ISO: 64,
      FocalLength: 6.86,
    });

    const metadata = await mediaMetadataService.extract(new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" }));

    expect(metadata?.width).toBe(3000);
    expect(metadata?.height).toBe(4000);
    expect(metadata?.details.case).toBe("photo");
    if (metadata?.details.case !== "photo") throw new Error("expected photo metadata");
    expect(metadata.details.value.captureTime?.localDateTime).toBe("2026-08-10T14:32:18.123");
    expect(metadata.details.value.captureTime?.utcOffset).toBeUndefined();
    expect(metadata.details.value.location).toMatchObject({ latitude: 1.3521, longitude: 103.8198, altitudeMeters: 18.4 });
    expect(metadata.details.value).toMatchObject({
      sourceExifOrientation: 6,
      cameraMake: "Apple",
      cameraModel: "iPhone",
      lensModel: "Main Camera",
      fNumber: 1.78,
      exposureTimeSeconds: 1 / 120,
      iso: 64,
      focalLengthMm: 6.86,
    });
  });

  it("preserves a valid EXIF UTC offset", async () => {
    mocks.parseExif.mockResolvedValue({
      DateTimeOriginal: "2026:08:10 14:32:18\0  ",
      OffsetTimeOriginal: "+08:00\0",
    });

    const metadata = await mediaMetadataService.extract(new File([new Uint8Array([1])], "photo.jpg", { type: "image/jpeg" }));

    expect(metadata?.details.case).toBe("photo");
    if (metadata?.details.case !== "photo") throw new Error("expected photo metadata");
    expect(metadata.details.value.captureTime?.utcOffset).toBe("+08:00");
  });

  it("drops incomplete raw GPS coordinates instead of guessing their direction", async () => {
    mocks.parseExif.mockResolvedValue({
      GPSLatitude: [1, 21, 7.56],
      GPSLongitude: [103, 49, 11.28],
      GPSLongitudeRef: "E",
    });

    const metadata = await mediaMetadataService.extract(new File([new Uint8Array([1])], "photo.jpg", { type: "image/jpeg" }));

    expect(metadata?.details.case).toBeUndefined();
    expect(metadata?.width).toBe(640);
    expect(metadata?.height).toBe(480);
  });

  it("falls back to browser dimensions when EXIF parsing fails", async () => {
    mocks.parseExif.mockRejectedValue(new Error("unsupported image"));

    const metadata = await mediaMetadataService.extract(new File([new Uint8Array([1])], "photo.webp", { type: "image/webp" }));

    expect(metadata?.width).toBe(640);
    expect(metadata?.height).toBe(480);
    expect(metadata?.details.case).toBeUndefined();
  });

  it("reads video dimensions and duration and revokes the object URL", async () => {
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = createElement(tagName, options);
      if (tagName.toLowerCase() !== "video") return element;
      Object.defineProperties(element, {
        videoWidth: { configurable: true, value: 1920 },
        videoHeight: { configurable: true, value: 1080 },
        duration: { configurable: true, value: 12.5 },
      });
      vi.spyOn(element as HTMLVideoElement, "load").mockImplementation(() => {
        queueMicrotask(() => element.dispatchEvent(new Event("loadedmetadata")));
      });
      return element;
    });

    const metadata = await mediaMetadataService.extract(new File([new Uint8Array([1])], "clip.mp4", { type: "video/mp4" }));

    expect(metadata?.width).toBe(1920);
    expect(metadata?.height).toBe(1080);
    expect(metadata?.details.case).toBe("video");
    if (metadata?.details.case !== "video") throw new Error("expected video metadata");
    expect(metadata.details.value.durationSeconds).toBe(12.5);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-media");
  });

  it("times out video extraction, revokes the object URL, and returns no metadata", async () => {
    vi.useFakeTimers();
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = createElement(tagName, options);
      if (tagName.toLowerCase() === "video") {
        vi.spyOn(element as HTMLVideoElement, "load").mockImplementation(() => undefined);
      }
      return element;
    });

    const extraction = mediaMetadataService.extract(new File([new Uint8Array([1])], "clip.mp4", { type: "video/mp4" }));
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(extraction).resolves.toBeUndefined();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-media");
  });

  it("ignores non-media files", async () => {
    const metadata = await mediaMetadataService.extract(new File(["hello"], "notes.txt", { type: "text/plain" }));

    expect(metadata).toBeUndefined();
    expect(mocks.parseExif).not.toHaveBeenCalled();
  });
});
