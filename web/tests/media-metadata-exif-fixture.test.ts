import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mediaMetadataService } from "@/components/MemoEditor/services/mediaMetadataService";

describe("mediaMetadataService EXIF fixture", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 2, height: 1, close: vi.fn() })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps selected fields from a real JPEG EXIF payload", async () => {
    const metadata = await mediaMetadataService.extract(buildExifJpegFixture());

    expect(metadata?.width).toBe(3000);
    expect(metadata?.height).toBe(4000);
    expect(metadata?.details.case).toBe("photo");
    if (metadata?.details.case !== "photo") throw new Error("expected photo metadata");

    expect(metadata.details.value.captureTime).toMatchObject({
      localDateTime: "2026-08-10T14:32:18.123",
      utcOffset: "+08:00",
    });
    expect(metadata.details.value.location).toMatchObject({
      latitude: 1.3521,
      longitude: 103.8198,
      altitudeMeters: 18.4,
    });
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
});

// A minimal JPEG containing a little-endian TIFF EXIF segment with known values.
function buildExifJpegFixture(): File {
  const tiff = new Uint8Array(424);
  const view = new DataView(tiff.buffer);
  const littleEndian = true;

  tiff.set([0x49, 0x49], 0);
  view.setUint16(2, 42, littleEndian);
  view.setUint32(4, 8, littleEndian);

  const writeEntry = (position: number, tag: number, type: number, count: number, value: number) => {
    view.setUint16(position, tag, littleEndian);
    view.setUint16(position + 2, type, littleEndian);
    view.setUint32(position + 4, count, littleEndian);
    view.setUint32(position + 8, value, littleEndian);
  };
  const writeShortEntry = (position: number, tag: number, value: number) => {
    writeEntry(position, tag, 3, 1, 0);
    view.setUint16(position + 8, value, littleEndian);
  };
  const writeByteEntry = (position: number, tag: number, value: number) => {
    writeEntry(position, tag, 1, 1, 0);
    view.setUint8(position + 8, value);
  };
  const writeInlineASCIIEntry = (position: number, tag: number, value: string) => {
    const bytes = new TextEncoder().encode(`${value}\0`);
    writeEntry(position, tag, 2, bytes.length, 0);
    tiff.set(bytes, position + 8);
  };
  const writeASCII = (offset: number, value: string) => {
    tiff.set(new TextEncoder().encode(`${value}\0`), offset);
  };
  const writeRational = (offset: number, numerator: number, denominator: number) => {
    view.setUint32(offset, numerator, littleEndian);
    view.setUint32(offset + 4, denominator, littleEndian);
  };

  // IFD0: camera identity, orientation, and pointers to the EXIF/GPS IFDs.
  view.setUint16(8, 5, littleEndian);
  writeEntry(10, 0x010f, 2, 6, 74);
  writeEntry(22, 0x0110, 2, 7, 80);
  writeShortEntry(34, 0x0112, 6);
  writeEntry(46, 0x8769, 4, 1, 88);
  writeEntry(58, 0x8825, 4, 1, 278);
  view.setUint32(70, 0, littleEndian);
  writeASCII(74, "Apple");
  writeASCII(80, "iPhone");

  // EXIF IFD: dimensions, capture time, and exposure details.
  view.setUint16(88, 10, littleEndian);
  writeEntry(90, 0x829a, 5, 1, 250);
  writeEntry(102, 0x829d, 5, 1, 242);
  writeShortEntry(114, 0x8827, 64);
  writeEntry(126, 0x9003, 2, 20, 214);
  writeEntry(138, 0x9011, 2, 7, 234);
  writeEntry(150, 0x920a, 5, 1, 258);
  writeInlineASCIIEntry(162, 0x9291, "123");
  writeEntry(174, 0xa002, 4, 1, 4000);
  writeEntry(186, 0xa003, 4, 1, 3000);
  writeEntry(198, 0xa434, 2, 12, 266);
  view.setUint32(210, 0, littleEndian);
  writeASCII(214, "2026:08:10 14:32:18");
  writeASCII(234, "+08:00");
  writeRational(242, 178, 100);
  writeRational(250, 1, 120);
  writeRational(258, 686, 100);
  writeASCII(266, "Main Camera");

  // GPS IFD: Singapore coordinates and altitude.
  view.setUint16(278, 7, littleEndian);
  writeEntry(280, 0x0000, 1, 4, 0x00000302);
  writeInlineASCIIEntry(292, 0x0001, "N");
  writeEntry(304, 0x0002, 5, 3, 368);
  writeInlineASCIIEntry(316, 0x0003, "E");
  writeEntry(328, 0x0004, 5, 3, 392);
  writeByteEntry(340, 0x0005, 0);
  writeEntry(352, 0x0006, 5, 1, 416);
  view.setUint32(364, 0, littleEndian);
  writeRational(368, 1, 1);
  writeRational(376, 21, 1);
  writeRational(384, 756, 100);
  writeRational(392, 103, 1);
  writeRational(400, 49, 1);
  writeRational(408, 1128, 100);
  writeRational(416, 184, 10);

  const exifPayload = new Uint8Array(6 + tiff.length);
  exifPayload.set(new TextEncoder().encode("Exif\0\0"));
  exifPayload.set(tiff, 6);
  const jpeg = new Uint8Array(2 + 2 + 2 + exifPayload.length + 2);
  jpeg.set([0xff, 0xd8, 0xff, 0xe1], 0);
  new DataView(jpeg.buffer).setUint16(4, exifPayload.length + 2);
  jpeg.set(exifPayload, 6);
  jpeg.set([0xff, 0xd9], jpeg.length - 2);
  return new File([jpeg], "known-exif.jpg", { type: "image/jpeg" });
}
