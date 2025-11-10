import { FileIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { getAttachmentThumbnailUrl, getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import { DisplayMode } from "./types";

interface AttachmentCardProps {
  attachment: Attachment;
  mode: DisplayMode;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
  showThumbnail?: boolean;
}

/**
 * Shared attachment card component
 * Displays thumbnails for images in both modes, with size variations
 */
const AttachmentCard = ({ attachment, mode, onRemove, onClick, className, showThumbnail = true }: AttachmentCardProps) => {
  const type = getAttachmentType(attachment);
  const attachmentUrl = getAttachmentUrl(attachment);
  const attachmentThumbnailUrl = getAttachmentThumbnailUrl(attachment);
  const isMedia = type === "image/*" || type === "video/*";

  // Editor mode - compact badge style with thumbnail
  if (mode === "edit") {
    return (
      <div
        className={cn(
          "relative inline-flex items-center gap-1.5 px-2 h-7 rounded-md border border-border bg-background text-secondary-foreground text-xs transition-colors hover:bg-accent",
          className,
        )}
      >
        {showThumbnail && type === "image/*" ? (
          <img src={attachmentThumbnailUrl} alt={attachment.filename} className="w-5 h-5 shrink-0 object-cover rounded" />
        ) : (
          <FileIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate max-w-[160px]">{attachment.filename}</span>
        {onRemove && (
          <button
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

  // View mode - media gets special treatment
  if (isMedia) {
    if (type === "image/*") {
      return (
        <img
          className={cn("cursor-pointer h-full w-auto rounded-lg border border-border/60 object-contain transition-colors", className)}
          src={attachmentThumbnailUrl}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src.includes("?thumbnail=true")) {
              target.src = attachmentUrl;
            }
          }}
          onClick={onClick}
          decoding="async"
          loading="lazy"
          alt={attachment.filename}
        />
      );
    } else if (type === "video/*") {
      return (
        <video
          className={cn(
            "cursor-pointer h-full w-auto rounded-lg border border-border/60 object-contain bg-muted transition-colors",
            className,
          )}
          preload="metadata"
          crossOrigin="anonymous"
          src={attachmentUrl}
          controls
        />
      );
    }
  }

  // View mode - non-media files (will be handled by parent component for proper file card display)
  return null;
};

export default AttachmentCard;
