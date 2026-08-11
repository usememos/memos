import { create } from "@bufbuild/protobuf";
import {
  MediaCaptureTimeSchema,
  MediaLocationSchema,
  type MediaMetadata,
  MediaMetadataSchema,
  PhotoMetadataSchema,
  VideoMetadataSchema,
} from "@/types/proto/api/v1/attachment_service_pb";
import { isImage } from "@/utils/attachment";

const EXTRACTION_TIMEOUT_MS = 5_000;
const MAX_METADATA_STRING_BYTES = 256;
const EXIF_TAGS = [
  "Make",
  "Model",
  "Orientation",
  "ImageWidth",
  "ImageHeight",
  "ExifImageWidth",
  "ExifImageHeight",
  "DateTimeOriginal",
  "CreateDate",
  "SubSecTimeOriginal",
  "SubSecTimeDigitized",
  "OffsetTimeOriginal",
  "OffsetTimeDigitized",
  "GPSLatitudeRef",
  "GPSLatitude",
  "GPSLongitudeRef",
  "GPSLongitude",
  "GPSAltitudeRef",
  "GPSAltitude",
  "LensModel",
  "FNumber",
  "ExposureTime",
  "ISO",
  "FocalLength",
];
const EXIF_PARSE_OPTIONS = {
  pick: EXIF_TAGS,
  translateValues: false,
  reviveValues: false,
  makerNote: false,
  userComment: false,
  xmp: false,
  icc: false,
  iptc: false,
  jfif: false,
  ihdr: false,
  ifd1: false,
};

const textEncoder = new TextEncoder();

type ExifTags = Record<string, unknown>;
type Dimensions = { width: number; height: number };

export const mediaMetadataService = {
  async extract(file: File): Promise<MediaMetadata | undefined> {
    try {
      if (isImage(file.type)) {
        return await extractImageMetadata(file);
      }
      if (file.type.startsWith("video/")) {
        return await extractVideoMetadata(file);
      }
    } catch {
      warnExtractionFailure();
    }
    return undefined;
  },
};

async function extractImageMetadata(file: File): Promise<MediaMetadata | undefined> {
  let tags: ExifTags = {};
  try {
    tags = await readExifTags(file);
  } catch {
    warnExtractionFailure();
  }

  const sourceExifOrientation = normalizeInteger(tags.Orientation, 1, 8);
  // EXIF dimensions come from a cheap header read; decode the image only when they are absent.
  const dimensions = readExifDimensions(tags, sourceExifOrientation) ?? (await readImageDimensions(file));

  const photoFields = {
    captureTime: readCaptureTime(tags),
    location: readLocation(tags),
    sourceExifOrientation,
    cameraMake: normalizeMetadataString(tags.Make),
    cameraModel: normalizeMetadataString(tags.Model),
    lensModel: normalizeMetadataString(tags.LensModel),
    fNumber: normalizePositiveNumber(tags.FNumber),
    exposureTimeSeconds: normalizePositiveNumber(tags.ExposureTime),
    iso: normalizeInteger(tags.ISO, 1),
    focalLengthMm: normalizePositiveNumber(tags.FocalLength),
  };
  const hasPhotoDetails = Object.values(photoFields).some((value) => value !== undefined);

  if (!dimensions && !hasPhotoDetails) {
    return undefined;
  }

  return create(MediaMetadataSchema, {
    width: dimensions?.width,
    height: dimensions?.height,
    details: hasPhotoDetails ? { case: "photo", value: create(PhotoMetadataSchema, photoFields) } : { case: undefined },
  });
}

async function readExifTags(file: File): Promise<ExifTags> {
  const exifr = await import("exifr");
  const parsed = await withTimeout(exifr.parse(file, EXIF_PARSE_OPTIONS), EXTRACTION_TIMEOUT_MS);
  return parsed && typeof parsed === "object" ? (parsed as ExifTags) : {};
}

function readExifDimensions(tags: ExifTags, orientation: number | undefined): Dimensions | undefined {
  const width = normalizeInteger(tags.ExifImageWidth ?? tags.ImageWidth, 1);
  const height = normalizeInteger(tags.ExifImageHeight ?? tags.ImageHeight, 1);
  if (width === undefined || height === undefined) {
    return undefined;
  }
  if (orientation !== undefined && orientation >= 5) {
    return { width: height, height: width };
  }
  return { width, height };
}

async function readImageDimensions(file: File): Promise<Dimensions | undefined> {
  if (typeof createImageBitmap !== "function") {
    return undefined;
  }
  const bitmapPromise = createImageBitmap(file);
  try {
    const bitmap = await withTimeout(bitmapPromise, EXTRACTION_TIMEOUT_MS);
    const dimensions = normalizeDimensions(bitmap.width, bitmap.height);
    bitmap.close();
    return dimensions;
  } catch {
    void bitmapPromise.then((bitmap) => bitmap.close()).catch(() => undefined);
    return undefined;
  }
}

async function extractVideoMetadata(file: File): Promise<MediaMetadata | undefined> {
  const { dimensions, durationSeconds } = await readVideoMetadata(file);
  if (!dimensions && durationSeconds === undefined) {
    return undefined;
  }

  return create(MediaMetadataSchema, {
    width: dimensions?.width,
    height: dimensions?.height,
    details:
      durationSeconds === undefined ? { case: undefined } : { case: "video", value: create(VideoMetadataSchema, { durationSeconds }) },
  });
}

async function readVideoMetadata(file: File): Promise<{ dimensions?: Dimensions; durationSeconds?: number }> {
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", fail);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    const fail = () => {
      cleanup();
      reject(new Error("video metadata extraction failed"));
    };
    const handleLoadedMetadata = () => {
      const dimensions = normalizeDimensions(video.videoWidth, video.videoHeight);
      const durationSeconds = Number.isFinite(video.duration) && video.duration >= 0 ? video.duration : undefined;
      cleanup();
      resolve({ dimensions, durationSeconds });
    };
    const timeout = window.setTimeout(fail, EXTRACTION_TIMEOUT_MS);

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("error", fail);
    video.src = url;
    video.load();
  });
}

function readCaptureTime(tags: ExifTags) {
  return (
    normalizeCaptureTime(tags.DateTimeOriginal, tags.SubSecTimeOriginal, tags.OffsetTimeOriginal) ??
    normalizeCaptureTime(tags.CreateDate, tags.SubSecTimeDigitized, tags.OffsetTimeDigitized)
  );
}

function normalizeCaptureTime(dateValue: unknown, subsecondValue: unknown, offsetValue: unknown) {
  if (typeof dateValue !== "string") {
    return undefined;
  }
  const match = cleanExifString(dateValue).match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return undefined;
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  if (!Number(yearText)) {
    return undefined;
  }
  const base = `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}`;
  // Round-trip through Date to reject impossible calendar dates: an invalid
  // component either yields NaN or rolls over so the ISO form no longer matches.
  const parsed = new Date(`${base}Z`);
  if (Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(base)) {
    return undefined;
  }

  const cleanedSubseconds = typeof subsecondValue === "string" ? cleanExifString(subsecondValue) : "";
  const subseconds = /^\d{1,9}$/.test(cleanedSubseconds) ? cleanedSubseconds : undefined;
  const localDateTime = subseconds ? `${base}.${subseconds}` : base;
  const utcOffset = normalizeUTCOffset(offsetValue);
  return create(MediaCaptureTimeSchema, { localDateTime, utcOffset });
}

function normalizeUTCOffset(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const offset = cleanExifString(value);
  if (offset === "Z") {
    return offset;
  }
  const match = offset.match(/^[+-](\d{2}):(\d{2})$/);
  if (!match) {
    return undefined;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 14 && minutes <= 59 && (hours !== 14 || minutes === 0) ? offset : undefined;
}

function readLocation(tags: ExifTags) {
  const latitude = normalizeCoordinate(tags.latitude, tags.GPSLatitude, tags.GPSLatitudeRef, 90, "N", "S");
  const longitude = normalizeCoordinate(tags.longitude, tags.GPSLongitude, tags.GPSLongitudeRef, 180, "E", "W");
  if (latitude === undefined || longitude === undefined) {
    return undefined;
  }
  const rawAltitude = normalizeFiniteNumber(tags.GPSAltitude);
  const altitudeRef = normalizeFiniteNumber(tags.GPSAltitudeRef);
  const altitudeMeters = rawAltitude === undefined ? undefined : altitudeRef === 1 ? -rawAltitude : rawAltitude;
  return create(MediaLocationSchema, { latitude, longitude, altitudeMeters });
}

function normalizeCoordinate(
  computed: unknown,
  dms: unknown,
  ref: unknown,
  maximum: number,
  positiveRef: string,
  negativeRef: string,
): number | undefined {
  const computedNumber = normalizeFiniteNumber(computed);
  if (computedNumber !== undefined && computedNumber >= -maximum && computedNumber <= maximum) {
    return computedNumber;
  }
  const direction = typeof ref === "string" ? cleanExifString(ref).toUpperCase() : "";
  if (!Array.isArray(dms) || dms.length < 3 || (direction !== positiveRef && direction !== negativeRef)) {
    return undefined;
  }
  const degrees = normalizeFiniteNumber(dms[0]);
  const minutes = normalizeFiniteNumber(dms[1]);
  const seconds = normalizeFiniteNumber(dms[2]);
  if (
    degrees === undefined ||
    minutes === undefined ||
    seconds === undefined ||
    degrees < 0 ||
    minutes < 0 ||
    minutes >= 60 ||
    seconds < 0 ||
    seconds >= 60
  ) {
    return undefined;
  }
  const sign = direction === negativeRef ? -1 : 1;
  const result = sign * (degrees + minutes / 60 + seconds / 3600);
  return result >= -maximum && result <= maximum ? result : undefined;
}

function normalizeMetadataString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  // Strip Unicode Cc control characters to match server-side validation.
  const normalized = value.replace(/\p{Cc}/gu, "").trim();
  if (!normalized || normalized.length > MAX_METADATA_STRING_BYTES) {
    return undefined;
  }
  return textEncoder.encode(normalized).byteLength > MAX_METADATA_STRING_BYTES ? undefined : normalized;
}

function cleanExifString(value: string): string {
  return value.replace(/[\0\s]+$/g, "").trimStart();
}

function normalizeFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (Array.isArray(value) || value instanceof Uint8Array) {
    return normalizeFiniteNumber(value[0]);
  }
  return undefined;
}

function normalizePositiveNumber(value: unknown): number | undefined {
  const number = normalizeFiniteNumber(value);
  return number !== undefined && number > 0 ? number : undefined;
}

function normalizeInteger(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number | undefined {
  const number = normalizeFiniteNumber(value);
  return number !== undefined && Number.isInteger(number) && number >= minimum && number <= maximum ? number : undefined;
}

function normalizeDimensions(width: number, height: number): Dimensions | undefined {
  return Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0 ? { width, height } : undefined;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error("media metadata extraction timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
    }
  }
}

function warnExtractionFailure() {
  if (import.meta.env.DEV) {
    console.warn("Media metadata extraction failed; continuing without metadata.");
  }
}
