// filepath: /Users/yuxuanli/Desktop/Project/Knowledge-Tree/web/src/components/attachment/previews/VideoLinkPreview.tsx

import { ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getProviderColor, getProviderDisplayName, parseVideoUrl } from "../utils/videoLinkResolver";

interface VideoLinkPreviewProps {
  /** The embed URL (iframe src) */
  src: string;
  /** Original video page URL for fallback */
  originalUrl?: string;
  /** Loading state */
  isLoading?: boolean;
}

export function VideoLinkPreview({ src, originalUrl, isLoading }: VideoLinkPreviewProps) {
  const [error, setError] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Parse the original URL to get provider info for display
  const videoInfo = originalUrl ? parseVideoUrl(originalUrl) : null;
  const providerName = videoInfo ? getProviderDisplayName(videoInfo.provider) : "Video";
  const providerColor = videoInfo ? getProviderColor(videoInfo.provider) : "text-gray-400";

  // Cross-origin iframes don't reliably fire onLoad events
  // Use a timeout to hide the loading overlay after a reasonable delay
  useEffect(() => {
    if (!src) return;

    // Reset states when src changes
    setShowLoading(true);
    setError(false);

    // Hide loading overlay after 1.5 seconds (iframe should have started loading by then)
    const timer = setTimeout(() => {
      setShowLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [src]);

  const handleRetry = () => {
    setError(false);
    setShowLoading(true);
    // Force iframe reload by updating src
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = '';
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = currentSrc;
        }
      }, 100);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-black/5 dark:bg-black/20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-muted-foreground bg-muted/30">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">Failed to load video</p>
          <p className="text-sm">The video embed could not be loaded. This may be due to privacy settings or network issues.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>

          {originalUrl && (
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open on {providerName}
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black">
      {/* Loading overlay - hidden after timeout */}
      {showLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 transition-opacity duration-300">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-4" />
          <p className={`text-sm ${providerColor}`}>Loading {providerName} video...</p>
        </div>
      )}

      {/* Video iframe - using attributes matching official embed codes */}
      <iframe
        ref={iframeRef}
        src={src}
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        scrolling="no"
        referrerPolicy="no-referrer-when-downgrade"
        loading="eager"
        title={`${providerName} video player`}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
      />

      {/* Provider badge */}
      {originalUrl && (
        <a
          href={originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-black/60 hover:bg-black/80 text-white text-xs rounded transition-colors z-20"
          title={`Open on ${providerName}`}
        >
          <ExternalLink className="w-3 h-3" />
          {providerName}
        </a>
      )}
    </div>
  );
}
