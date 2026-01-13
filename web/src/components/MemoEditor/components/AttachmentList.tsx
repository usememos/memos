import { ChevronDownIcon, ChevronUpIcon, FileIcon, PaperclipIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";
import type { LocalFile } from "../types/attachment";
import { toAttachmentItems } from "../types/attachment";

interface AttachmentListProps {
  attachments: Attachment[];
  localFiles?: LocalFile[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  onRemoveLocalFile?: (previewUrl: string) => void;
}

const AttachmentItemCard: FC<{
  item: ReturnType<typeof toAttachmentItems>[0];
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}> = ({ item, onRemove, onMoveUp, onMoveDown, canMoveUp = true, canMoveDown = true }) => {
  const { category, filename, thumbnailUrl, mimeType, size } = item;
  const fileTypeLabel = getFileTypeLabel(mimeType);
  const fileSizeLabel = size ? formatFileSize(size) : undefined;

  return (
    <div className="relative flex items-center gap-1.5 px-1.5 py-1 rounded border border-transparent hover:border-border hover:bg-accent/20 transition-all">
      <div className="shrink-0 w-6 h-6 rounded overflow-hidden bg-muted/40 flex items-center justify-center">
        {category === "image" && thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <FileIcon className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-1.5">
        <span className="text-xs truncate" title={filename}>
          {filename}
        </span>

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
          <span>{fileTypeLabel}</span>
          {fileSizeLabel && (
            <>
              <span className="text-muted-foreground/50 hidden sm:inline">•</span>
              <span className="hidden sm:inline">{fileSizeLabel}</span>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-0.5">
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

const AttachmentList: FC<AttachmentListProps> = ({ attachments, localFiles = [], onAttachmentsChange, onRemoveLocalFile }) => {
  if (attachments.length === 0 && localFiles.length === 0) {
    return null;
  }

  const items = toAttachmentItems(attachments, localFiles);

  const handleMoveUp = (index: number) => {
    if (index === 0 || !onAttachmentsChange) return;

    const newAttachments = [...attachments];
    [newAttachments[index - 1], newAttachments[index]] = [newAttachments[index], newAttachments[index - 1]];
    onAttachmentsChange(newAttachments);
  };

  const handleMoveDown = (index: number) => {
    if (index === attachments.length - 1 || !onAttachmentsChange) return;

    const newAttachments = [...attachments];
    [newAttachments[index], newAttachments[index + 1]] = [newAttachments[index + 1], newAttachments[index]];
    onAttachmentsChange(newAttachments);
  };

  const handleRemoveAttachment = (name: string) => {
    if (onAttachmentsChange) {
      onAttachmentsChange(attachments.filter((attachment) => attachment.name !== name));
    }
  };

  const handleRemoveItem = (item: (typeof items)[0]) => {
    if (item.isLocal) {
      onRemoveLocalFile?.(item.id);
    } else {
      handleRemoveAttachment(item.id);
    }
  };

  return (
    <div className="w-full rounded-lg border border-border bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-muted/30">
        <PaperclipIcon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Attachments ({items.length})</span>
      </div>

      <div className="p-1 sm:p-1.5 flex flex-col gap-0.5">
        {items.map((item) => {
          const isLocalFile = item.isLocal;
          const attachmentIndex = isLocalFile ? -1 : attachments.findIndex((a) => a.name === item.id);

          return (
            <AttachmentItemCard
              key={item.id}
              item={item}
              onRemove={() => handleRemoveItem(item)}
              onMoveUp={!isLocalFile ? () => handleMoveUp(attachmentIndex) : undefined}
              onMoveDown={!isLocalFile ? () => handleMoveDown(attachmentIndex) : undefined}
              canMoveUp={!isLocalFile && attachmentIndex > 0}
              canMoveDown={!isLocalFile && attachmentIndex < attachments.length - 1}
            />
          );
        })}
      </div>
    </div>
  );
};

export default AttachmentList;
