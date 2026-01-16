// filepath: /Users/yuxuanli/Desktop/Project/Knowledge-Tree/web/src/components/attachment/utils/videoLinkResolver.ts

/**
 * Video link resolver utility
 * Parses video URLs from various providers and extracts embed URLs
 */

export type VideoProvider = "youtube" | "bilibili" | "vimeo" | "unknown";

export interface VideoLinkInfo {
  provider: VideoProvider;
  videoId: string;
  embedUrl: string;
  thumbnailUrl?: string;
  originalUrl: string;
}

interface ProviderConfig {
  name: VideoProvider;
  patterns: RegExp[];
  getEmbedUrl: (id: string) => string;
  getThumbnail?: (id: string) => string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: "youtube",
    patterns: [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
    ],
    getEmbedUrl: (id: string) => `https://www.youtube.com/embed/${id}`,
    getThumbnail: (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
  },
  {
    name: "bilibili",
    patterns: [
      /bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i,
      /bilibili\.com\/video\/av(\d+)/i,
      /b23\.tv\/([a-zA-Z0-9]+)/,
    ],
    getEmbedUrl: (id: string) => {
      // Official Bilibili embed format requires isOutside=true for external sites
      // BV format (newer)
      if (id.toUpperCase().startsWith("BV")) {
        return `https://player.bilibili.com/player.html?isOutside=true&bvid=${id}&autoplay=0&p=1`;
      }
      // AV format (legacy)
      return `https://player.bilibili.com/player.html?isOutside=true&aid=${id}&autoplay=0&p=1`;
    },
    // Bilibili doesn't have a simple public thumbnail URL format
    getThumbnail: undefined,
  },
  {
    name: "vimeo",
    patterns: [/vimeo\.com\/(\d+)/, /player\.vimeo\.com\/video\/(\d+)/],
    getEmbedUrl: (id: string) => `https://player.vimeo.com/video/${id}`,
    // Vimeo thumbnails require API access
    getThumbnail: undefined,
  },
];

/**
 * Parse a video URL and extract embed information
 * @param url The video URL to parse
 * @returns VideoLinkInfo if the URL is recognized, null otherwise
 */
export function parseVideoUrl(url: string): VideoLinkInfo | null {
  if (!url) return null;

  // Normalize URL
  const normalizedUrl = url.trim();

  for (const provider of PROVIDERS) {
    for (const pattern of provider.patterns) {
      const match = normalizedUrl.match(pattern);
      if (match && match[1]) {
        const videoId = match[1];
        return {
          provider: provider.name,
          videoId,
          embedUrl: provider.getEmbedUrl(videoId),
          thumbnailUrl: provider.getThumbnail?.(videoId),
          originalUrl: normalizedUrl,
        };
      }
    }
  }

  return null;
}

/**
 * Check if a URL is a recognized video URL
 * @param url The URL to check
 * @returns true if the URL is a recognized video URL
 */
export function isVideoUrl(url: string): boolean {
  return parseVideoUrl(url) !== null;
}

/**
 * Get the provider name for display
 * @param provider The video provider
 * @returns Display name for the provider
 */
export function getProviderDisplayName(provider: VideoProvider): string {
  const displayNames: Record<VideoProvider, string> = {
    youtube: "YouTube",
    bilibili: "Bilibili",
    vimeo: "Vimeo",
    unknown: "Video",
  };
  return displayNames[provider];
}

/**
 * Get provider icon/color for UI
 * @param provider The video provider
 * @returns CSS color class for the provider
 */
export function getProviderColor(provider: VideoProvider): string {
  const colors: Record<VideoProvider, string> = {
    youtube: "text-red-500",
    bilibili: "text-pink-400",
    vimeo: "text-blue-400",
    unknown: "text-gray-400",
  };
  return colors[provider];
}

/**
 * Generate a virtual MIME type for video links
 * This is used to identify video links in the attachment system
 */
export const VIDEO_LINK_MIME_TYPE = "application/x-video-link";

/**
 * Generate a filename for display based on video info
 * @param info The video link info
 * @returns A display filename
 */
export function generateVideoLinkFilename(info: VideoLinkInfo): string {
  return `${getProviderDisplayName(info.provider)} Video (${info.videoId})`;
}
