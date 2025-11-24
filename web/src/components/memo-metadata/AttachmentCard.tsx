import { FileIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttachmentItem, DisplayMode } from "./types";

interface AttachmentCardProps {
  /** Unified attachment item (uploaded or local file) */
  item: AttachmentItem;
  mode: DisplayMode;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
  showThumbnail?: boolean;
}

/**
 * Unified attachment card component for all file types
 * Renders differently based on mode (edit/view) and file category
 */
const AttachmentCard = ({ item, mode, onRemove, onClick, className, showThumbnail = true }: AttachmentCardProps) => {
  const { category, filename, thumbnailUrl, sourceUrl } = item;
  const isMedia = category === "image" || category === "video";

  // Editor mode - compact badge style with optional thumbnail
  if (mode === "edit") {
    return (
      <div
        className={cn(
          "relative inline-flex items-center gap-1.5 px-2 h-7 rounded-md border text-secondary-foreground text-xs transition-colors",
          "border-border bg-background hover:bg-accent",
          className,
        )}
      >
        {showThumbnail && category === "image" && thumbnailUrl ? (
          <img src={thumbnailUrl} alt={filename} className="w-5 h-5 shrink-0 object-cover rounded" />
        ) : (
          <FileIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate max-w-40">{filename}</span>
        {onRemove && (
          <button
            type="button"
            className="shrink-0 rounded hover:bg-accent transition-colors p-0.5"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
          >
            <XIcon className="w-3 h-3 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
    );
  }

  // View mode - specialized rendering for media
  if (isMedia) {
    if (category === "image") {
      return (
        <img
          className={cn("cursor-pointer h-full w-auto rounded-lg border border-border/60 object-contain transition-colors", className)}
          src={thumbnailUrl}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            // Fallback to source URL if thumbnail fails
            if (target.src.includes("?thumbnail=true")) {
              target.src = sourceUrl;
            }
          }}
          onClick={onClick}
          decoding="async"
          loading="lazy"
          alt={filename}
        />
      );
    } else if (category === "video") {
      return (
        <video
          className={cn(
            "cursor-pointer h-full w-auto rounded-lg border border-border/60 object-contain bg-muted transition-colors",
            className,
          )}
          preload="metadata"
          crossOrigin="anonymous"
          src={sourceUrl}
          controls
        />
      );
    }
  }

  // View mode - non-media files (will be handled by parent component for proper file card display)
  return null;
};

export default AttachmentCard;
