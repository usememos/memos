import { ChevronDownIcon, ChevronUpIcon, FileIcon, Loader2Icon, XIcon } from "lucide-react";
import type { FC } from "react";
import type { AttachmentItem } from "@/components/memo-metadata/types";
import { cn } from "@/lib/utils";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";

interface AttachmentItemCardProps {
  item: AttachmentItem;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  className?: string;
}

const AttachmentItemCard: FC<AttachmentItemCardProps> = ({
  item,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  className,
}) => {
  const { category, filename, thumbnailUrl, mimeType, size, isLocal } = item;
  const fileTypeLabel = getFileTypeLabel(mimeType);
  const fileSizeLabel = size ? formatFileSize(size) : undefined;

  return (
    <div
      className={cn(
        "relative flex items-center gap-1.5 px-1.5 py-1 rounded border border-transparent hover:border-border hover:bg-accent/20 transition-all",
        className,
      )}
    >
      <div className="flex-shrink-0 w-6 h-6 rounded overflow-hidden bg-muted/40 flex items-center justify-center">
        {category === "image" && thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <FileIcon className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-1.5">
        <span className="text-xs font-medium truncate" title={filename}>
          {filename}
        </span>

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
          {isLocal && (
            <>
              <Loader2Icon className="w-2.5 h-2.5 animate-spin" />
              <span className="text-muted-foreground/50">•</span>
            </>
          )}
          <span>{fileTypeLabel}</span>
          {fileSizeLabel && (
            <>
              <span className="text-muted-foreground/50 hidden sm:inline">•</span>
              <span className="hidden sm:inline">{fileSizeLabel}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center gap-0.5">
        {onMoveUp && (
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className={cn(
              "p-0.5 rounded hover:bg-accent active:bg-accent transition-colors touch-manipulation",
              !canMoveUp && "opacity-20 cursor-not-allowed hover:bg-transparent",
            )}
            title="Move up"
            aria-label="Move attachment up"
          >
            <ChevronUpIcon className="w-3 h-3 text-muted-foreground" />
          </button>
        )}

        {onMoveDown && (
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className={cn(
              "p-0.5 rounded hover:bg-accent active:bg-accent transition-colors touch-manipulation",
              !canMoveDown && "opacity-20 cursor-not-allowed hover:bg-transparent",
            )}
            title="Move down"
            aria-label="Move attachment down"
          >
            <ChevronDownIcon className="w-3 h-3 text-muted-foreground" />
          </button>
        )}

        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-0.5 rounded hover:bg-destructive/10 active:bg-destructive/10 transition-colors ml-0.5 touch-manipulation"
            title="Remove"
            aria-label="Remove attachment"
          >
            <XIcon className="w-3 h-3 text-muted-foreground hover:text-destructive" />
          </button>
        )}
      </div>
    </div>
  );
};

export default AttachmentItemCard;
