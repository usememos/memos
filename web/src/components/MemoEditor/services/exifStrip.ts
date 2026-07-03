// Client-side EXIF stripping. The Cloudflare Worker no longer re-encodes images
// server-side, so we strip metadata here by drawing the image onto a canvas and
// re-exporting it. Motion photos are skipped: their embedded video/metadata must
// survive intact, mirroring the skip logic in the former Go fileserver.

// MIME types the canvas pipeline can safely re-encode.
const STRIPPABLE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export interface StripOptions {
  /** When true (motion photo), the file is returned untouched. */
  isMotionMedia?: boolean;
}

export async function stripImageMetadata(file: File, options: StripOptions = {}): Promise<File> {
  if (options.isMotionMedia || !STRIPPABLE_TYPES.has(file.type)) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file;
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    // PNG is lossless; JPEG/WebP re-encode at high quality to preserve fidelity.
    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, 0.95));
    if (!blob) {
      return file;
    }
    const outputName = outputType === "image/png" ? file.name : file.name.replace(/\.(jpe?g|png|webp)$/i, ".jpg");
    return new File([blob], outputName, { type: outputType });
  } catch {
    // If anything fails, fall back to the original file rather than blocking upload.
    return file;
  }
}
