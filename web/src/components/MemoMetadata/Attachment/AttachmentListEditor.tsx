import { ChevronDownIcon, ChevronUpIcon, FileIcon, PaperclipIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import type { AttachmentItem, LocalFile } from "@/components/MemoEditor/types/attachment";
import { toAttachmentItems } from "@/components/MemoEditor/types/attachment";
import MetadataSection from "@/components/MemoMetadata/MetadataSection";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";

interface AttachmentListEditorProps {
  attachments: Attachment[];
  localFiles?: LocalFile[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  onLocalFilesChange?: (localFiles: LocalFile[]) => void;
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
  const { category, filename, thumbnailUrl, mimeType, size } = item;
  const fileTypeLabel = item.category === "motion" ? "Live Photo" : getFileTypeLabel(mimeType);
  const fileSizeLabel = size ? formatFileSize(size) : undefined;
  const displayName = category === "audio" && /^voice-(recording|note)-/i.test(filename) ? "Voice note" : filename;

  return (
    <div className="relative rounded border border-transparent px-1.5 py-1 transition-all hover:border-border hover:bg-accent/20">
      <div className="flex items-center gap-1.5">
        <div className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-muted/40">
          {(category === "image" || category === "motion") && thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {category === "motion" && (
            <span className="absolute inset-x-0 bottom-0 bg-black/70 text-center text-[7px] font-semibold uppercase tracking-wide text-white">
              Live
            </span>
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

const AttachmentListEditor: FC<AttachmentListEditorProps> = ({
  attachments,
  localFiles = [],
  onAttachmentsChange,
  onLocalFilesChange,
  onRemoveLocalFile,
}) => {
  if (attachments.length === 0 && localFiles.length === 0) {
    return null;
  }

  const items = toAttachmentItems(attachments, localFiles);
  const attachmentItems = items.filter((item) => !item.isLocal);
  const localItems = items.filter((item) => item.isLocal);

  const handleMoveAttachments = (itemId: string, direction: -1 | 1) => {
    if (!onAttachmentsChange) return;

    const itemIndex = attachmentItems.findIndex((item) => item.id === itemId);
    const targetIndex = itemIndex + direction;
    if (itemIndex < 0 || targetIndex < 0 || targetIndex >= attachmentItems.length) {
      return;
    }

    const reorderedItems = [...attachmentItems];
    [reorderedItems[itemIndex], reorderedItems[targetIndex]] = [reorderedItems[targetIndex], reorderedItems[itemIndex]];

    const attachmentMap = new Map(attachments.map((attachment) => [attachment.name, attachment]));
    onAttachmentsChange(
      reorderedItems.flatMap((item) => item.memberIds.map((memberId) => attachmentMap.get(memberId)).filter(Boolean) as Attachment[]),
    );
  };

  const handleMoveLocalFiles = (itemId: string, direction: -1 | 1) => {
    if (!onLocalFilesChange) return;

    const itemIndex = localItems.findIndex((item) => item.id === itemId);
    const targetIndex = itemIndex + direction;
    if (itemIndex < 0 || targetIndex < 0 || targetIndex >= localItems.length) {
      return;
    }

    const reorderedItems = [...localItems];
    [reorderedItems[itemIndex], reorderedItems[targetIndex]] = [reorderedItems[targetIndex], reorderedItems[itemIndex]];

    const localFileMap = new Map(localFiles.map((localFile) => [localFile.previewUrl, localFile]));
    onLocalFilesChange(
      reorderedItems.flatMap((item) => item.memberIds.map((memberId) => localFileMap.get(memberId)).filter(Boolean) as LocalFile[]),
    );
  };

  const handleRemoveItem = (item: AttachmentItem) => {
    if (item.isLocal) {
      const nextLocalFiles = localFiles.filter((file) => !item.memberIds.includes(file.previewUrl));
      onLocalFilesChange?.(nextLocalFiles);
      if (!onLocalFilesChange) {
        item.memberIds.forEach((previewUrl) => onRemoveLocalFile?.(previewUrl));
      }
      return;
    }

    if (onAttachmentsChange) {
      onAttachmentsChange(attachments.filter((attachment) => !item.memberIds.includes(attachment.name)));
    }
  };

  return (
    <MetadataSection icon={PaperclipIcon} title="Attachments" count={items.length} contentClassName="flex flex-col gap-0.5 p-1 sm:p-1.5">
      {items.map((item) => {
        const itemList = item.isLocal ? localItems : attachmentItems;
        const itemIndex = itemList.findIndex((entry) => entry.id === item.id);

        return (
          <AttachmentItemCard
            key={item.id}
            item={item}
            onRemove={() => handleRemoveItem(item)}
            onMoveUp={item.isLocal ? () => handleMoveLocalFiles(item.id, -1) : () => handleMoveAttachments(item.id, -1)}
            onMoveDown={item.isLocal ? () => handleMoveLocalFiles(item.id, 1) : () => handleMoveAttachments(item.id, 1)}
            canMoveUp={itemIndex > 0}
            canMoveDown={itemIndex >= 0 && itemIndex < itemList.length - 1}
          />
        );
      })}
    </MetadataSection>
  );
};

export default AttachmentListEditor;
