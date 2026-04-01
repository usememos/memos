import { ChevronDownIcon, ChevronUpIcon, FileIcon, PaperclipIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import type { AttachmentItem, LocalFile } from "@/components/MemoEditor/types/attachment";
import { toAttachmentItems } from "@/components/MemoEditor/types/attachment";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";
import SectionHeader from "../SectionHeader";
import AudioAttachmentItem from "./AudioAttachmentItem";

interface AttachmentListEditorProps {
  attachments: Attachment[];
  localFiles?: LocalFile[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  onRemoveLocalFile?: (previewUrl: string) => void;
}

const AttachmentItemCard: FC<{
  item: AttachmentItem;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}> = ({ item, onRemove, onMoveUp, onMoveDown, canMoveUp = true, canMoveDown = true }) => {
  const { category, filename, thumbnailUrl, mimeType, size, sourceUrl } = item;
  const fileTypeLabel = getFileTypeLabel(mimeType);
  const fileSizeLabel = size ? formatFileSize(size) : undefined;
  const displayName = category === "audio" && /^voice-(recording|note)-/i.test(filename) ? "Voice note" : filename;

  if (category === "audio") {
    return (
      <div className="rounded border border-transparent transition-all hover:border-border hover:bg-accent/20">
        <AudioAttachmentItem
          filename={filename}
          displayName={displayName}
          sourceUrl={sourceUrl}
          mimeType={mimeType}
          size={size}
          actionSlot={
            onRemove ? (
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex size-6.5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Remove"
                aria-label="Remove attachment"
              >
                <XIcon className="h-3 w-3" />
              </button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="relative rounded border border-transparent px-1.5 py-1 transition-all hover:border-border hover:bg-accent/20">
      <div className="flex items-center gap-1.5">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-muted/40">
          {category === "image" && thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-1.5">
          <span className="truncate text-xs" title={filename}>
            {displayName}
          </span>

          <div className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
            <span>{fileTypeLabel}</span>
            {fileSizeLabel && (
              <>
                <span className="hidden text-muted-foreground/50 sm:inline">•</span>
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
                "touch-manipulation rounded p-0.5 transition-colors hover:bg-accent active:bg-accent",
                !canMoveUp && "cursor-not-allowed opacity-20 hover:bg-transparent",
              )}
              title="Move up"
              aria-label="Move attachment up"
            >
              <ChevronUpIcon className="h-3 w-3 text-muted-foreground" />
            </button>
          )}

          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className={cn(
                "touch-manipulation rounded p-0.5 transition-colors hover:bg-accent active:bg-accent",
                !canMoveDown && "cursor-not-allowed opacity-20 hover:bg-transparent",
              )}
              title="Move down"
              aria-label="Move attachment down"
            >
              <ChevronDownIcon className="h-3 w-3 text-muted-foreground" />
            </button>
          )}

          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="ml-0.5 touch-manipulation rounded p-0.5 transition-colors hover:bg-destructive/10 active:bg-destructive/10"
              title="Remove"
              aria-label="Remove attachment"
            >
              <XIcon className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const AttachmentListEditor: FC<AttachmentListEditorProps> = ({ attachments, localFiles = [], onAttachmentsChange, onRemoveLocalFile }) => {
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
      <SectionHeader icon={PaperclipIcon} title="Attachments" count={items.length} />

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

export default AttachmentListEditor;
