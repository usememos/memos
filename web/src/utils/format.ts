export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 0) return "Invalid size";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const k = 1024;
  let i = Math.min(Math.max(Math.floor(Math.log(bytes) / Math.log(k)), 0), units.length - 1);
  // Just under the next unit, rounding to one decimal reaches 1024 (1048575 bytes is "1024.0 KB"),
  // so show it as 1.0 of the next unit instead
  if (i > 0 && i < units.length - 1 && Number((bytes / Math.pow(k, i)).toFixed(1)) >= k) {
    i++;
  }
  const size = bytes / Math.pow(k, i);
  const formatted = i === 0 ? size.toString() : size.toFixed(1);

  return `${formatted} ${units[i]}`;
}

export function getFileTypeLabel(mimeType: string): string {
  if (!mimeType) return "File";

  const normalizedMimeType = mimeType.toLowerCase().split(";")[0].trim();
  const [category = "", subtype = ""] = normalizedMimeType.split("/");

  const specialCases: Record<string, string> = {
    "application/pdf": "PDF",
    "application/zip": "ZIP",
    "application/x-zip-compressed": "ZIP",
    "application/json": "JSON",
    "application/xml": "XML",
    "text/plain": "TXT",
    "text/html": "HTML",
    "text/css": "CSS",
    "text/javascript": "JS",
    "application/javascript": "JS",
  };

  if (specialCases[normalizedMimeType]) {
    return specialCases[normalizedMimeType];
  }

  if (category === "image") {
    const imageTypes: Record<string, string> = {
      jpeg: "JPEG",
      jpg: "JPEG",
      png: "PNG",
      gif: "GIF",
      webp: "WebP",
      svg: "SVG",
      "svg+xml": "SVG",
      bmp: "BMP",
      ico: "ICO",
    };
    return imageTypes[subtype] || subtype.toUpperCase();
  }

  if (category === "video") {
    const videoTypes: Record<string, string> = {
      mp4: "MP4",
      webm: "WEBM",
      ogg: "OGG",
      avi: "AVI",
      mov: "MOV",
      quicktime: "MOV",
    };
    return videoTypes[subtype] || subtype.toUpperCase();
  }

  if (category === "audio") {
    const audioTypes: Record<string, string> = {
      mp3: "MP3",
      mpeg: "MP3",
      wav: "WAV",
      ogg: "OGG",
      webm: "WEBM",
    };
    return audioTypes[subtype] || subtype.toUpperCase();
  }

  return subtype ? subtype.toUpperCase() : category.toUpperCase();
}
