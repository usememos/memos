import { useState } from "react";

/** Extracts a video ID from a supported YouTube URL. */
export function getYouTubeVideoId(input: string): string | undefined {
  try {
    const url = new URL(input);
    if (!["https:", "http:"].includes(url.protocol)) return undefined;

    const host = url.hostname.replace(/^www\./, "");
    const parts = url.pathname.split("/").filter(Boolean);
    let id: string | undefined;

    if (host === "youtu.be" && parts.length === 1) {
      id = parts[0];
    } else if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        id = url.searchParams.get("v") ?? undefined;
      } else if (parts.length === 2 && ["shorts", "embed", "live"].includes(parts[0])) {
        id = parts[1];
      }
    }

    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

/** Thumbnail content mounted inside the original Markdown link. */
export function YouTubePreview({ videoId }: { videoId: string }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <span className="my-2 inline-block w-full max-w-lg overflow-hidden rounded-md border border-border align-middle">
      {!imageFailed && (
        <img
          src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
          alt="YouTube"
          className="aspect-video w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      )}
    </span>
  );
}
