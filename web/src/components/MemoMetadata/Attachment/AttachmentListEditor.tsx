import { ChevronDownIcon, ChevronUpIcon, FileAudioIcon, FileIcon, PaperclipIcon, PauseIcon, PlayIcon, XIcon } from "lucide-react";
import { type FC, type MouseEvent, useMemo, useRef, useState } from "react";
import type { AttachmentItem, LocalFile } from "@/components/MemoEditor/types/attachment";
import { getAudioRecordingTimeLabel, toAttachmentItems } from "@/components/MemoEditor/types/attachment";
import MetadataSection from "@/components/MemoMetadata/MetadataSection";
import PreviewImageDialog from "@/components/PreviewImageDialog";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";
import { useTranslate } from "@/utils/i18n";
import type { PreviewMediaItem } from "@/utils/media-item";
import { formatAudioTime } from "./attachmentHelpers";

interface AttachmentListEditorProps {
  attachments: Attachment[];
  localFiles?: LocalFile[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  onLocalFilesChange?: (localFiles: LocalFile[]) => void;
  onRemoveLocalFile?: (previewUrl: string) => void;
}

const AttachmentItemActions: FC<{
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}> = ({ onRemove, onMoveUp, onMoveDown, canMoveUp = true, canMoveDown = true }) => {
  const stopPropagation = (event: MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <div className="shrink-0 flex items-center gap-0.5">
      {onMoveUp && (
        <button
          type="button"
          onClick={(event) => {
            stopPropagation(event);
            onMoveUp();
          }}
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
          onClick={(event) => {
            stopPropagation(event);
            onMoveDown();
          }}
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
          onClick={(event) => {
            stopPropagation(event);
            onRemove();
          }}
          className="ml-0.5 touch-manipulation rounded p-0.5 transition-colors hover:bg-destructive/10 active:bg-destructive/10"
          title="Remove"
          aria-label="Remove attachment"
        >
          <XIcon className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </div>
  );
};

const AttachmentItemCard: FC<{
  item: AttachmentItem;
  onPreview?: () => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}> = ({ item, onPreview, onRemove, onMoveUp, onMoveDown, canMoveUp = true, canMoveDown = true }) => {
  const t = useTranslate();
  const { category, filename, thumbnailUrl, mimeType, size, sourceUrl, isVoiceNote, audioMeta } = item;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const fileTypeLabel = item.category === "motion" ? "Live Photo" : getFileTypeLabel(mimeType);
  const isPreviewable = category === "image" || category === "video" || category === "motion";
  const recordingTimeLabel = isVoiceNote ? getAudioRecordingTimeLabel(filename) : undefined;
  const titleLabel =
    isVoiceNote && recordingTimeLabel
      ? t("editor.audio-recorder.attachment-label-with-time", { time: recordingTimeLabel })
      : isVoiceNote
        ? t("editor.audio-recorder.attachment-label")
        : filename;
  const detailParts = [
    audioMeta?.durationSeconds ? formatAudioTime(audioMeta.durationSeconds) : undefined,
    fileTypeLabel,
    size ? formatFileSize(size) : undefined,
  ].filter(Boolean);

  const handleAudioToggle = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    audio.pause();
  };

  return (
    <div className="relative rounded border border-transparent px-1.5 py-1 transition-all hover:border-border hover:bg-accent/20">
      <div className="flex items-center gap-1.5">
        <div className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-muted/40">
          {(category === "image" || category === "motion") && thumbnailUrl ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onPreview?.();
              }}
              className={cn("h-full w-full overflow-hidden", isPreviewable ? "cursor-pointer" : "cursor-default")}
              aria-label={`Preview ${filename}`}
            >
              <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
            </button>
          ) : isVoiceNote ? (
            <>
              <button
                type="button"
                onClick={handleAudioToggle}
                className="flex size-full items-center justify-center rounded bg-muted/40 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={isPlaying ? t("editor.audio-recorder.pause-recording") : t("editor.audio-recorder.play-recording")}
              >
                {isPlaying ? <PauseIcon className="h-3.5 w-3.5" /> : <PlayIcon className="h-3.5 w-3.5 translate-x-[0.5px]" />}
              </button>
              <audio
                ref={audioRef}
                src={sourceUrl}
                preload="metadata"
                className="hidden"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
            </>
          ) : category === "video" ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onPreview?.();
              }}
              className="flex size-full items-center justify-center rounded bg-muted/40 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={`Preview ${filename}`}
            >
              <PlayIcon className="h-3.5 w-3.5 translate-x-[0.5px]" />
            </button>
          ) : category === "audio" ? (
            <FileAudioIcon className="h-3.5 w-3.5 text-muted-foreground" />
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
            {titleLabel}
          </span>

          <div className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
            {detailParts.map((part, index) => (
              <span key={`${item.id}-${part}`}>
                {index > 0 && <span className="hidden text-muted-foreground/50 sm:inline"> • </span>}
                <span>{part}</span>
              </span>
            ))}
          </div>
        </div>

        <AttachmentItemActions
          onRemove={onRemove}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
        />
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
  const [previewState, setPreviewState] = useState<{ open: boolean; initialIndex: number }>({ open: false, initialIndex: 0 });
  const items = toAttachmentItems(attachments, localFiles);
  const attachmentItems = items.filter((item) => !item.isLocal);
  const localItems = items.filter((item) => item.isLocal);
  const previewItems = useMemo<PreviewMediaItem[]>(
    () =>
      items.reduce<PreviewMediaItem[]>((acc, item) => {
        if (item.category === "image") {
          acc.push({ id: item.id, kind: "image", sourceUrl: item.sourceUrl, posterUrl: item.thumbnailUrl, filename: item.filename });
          return acc;
        }

        if (item.category === "video") {
          acc.push({ id: item.id, kind: "video", sourceUrl: item.sourceUrl, posterUrl: item.thumbnailUrl, filename: item.filename });
          return acc;
        }

        if (item.category === "motion") {
          acc.push({ id: item.id, kind: "motion", motionUrl: item.sourceUrl, posterUrl: item.thumbnailUrl, filename: item.filename });
          return acc;
        }

        return acc;
      }, []),
    [items],
  );

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

  const handlePreviewItem = (item: AttachmentItem) => {
    const previewIndex = previewItems.findIndex((previewItem) => previewItem.id === item.id);
    if (previewIndex < 0) {
      return;
    }

    setPreviewState({ open: true, initialIndex: previewIndex });
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <MetadataSection icon={PaperclipIcon} title="Attachments" count={items.length} contentClassName="flex flex-col gap-1 p-1 sm:p-1.5">
        {items.map((item) => {
          const itemList = item.isLocal ? localItems : attachmentItems;
          const itemIndex = itemList.findIndex((entry) => entry.id === item.id);

          return (
            <AttachmentItemCard
              key={item.id}
              item={item}
              onPreview={
                item.category === "image" || item.category === "video" || item.category === "motion"
                  ? () => handlePreviewItem(item)
                  : undefined
              }
              onRemove={() => handleRemoveItem(item)}
              onMoveUp={item.isLocal ? () => handleMoveLocalFiles(item.id, -1) : () => handleMoveAttachments(item.id, -1)}
              onMoveDown={item.isLocal ? () => handleMoveLocalFiles(item.id, 1) : () => handleMoveAttachments(item.id, 1)}
              canMoveUp={itemIndex > 0}
              canMoveDown={itemIndex >= 0 && itemIndex < itemList.length - 1}
            />
          );
        })}
      </MetadataSection>

      <PreviewImageDialog
        open={previewState.open}
        onOpenChange={(open) => setPreviewState((state) => ({ ...state, open }))}
        items={previewItems}
        initialIndex={previewState.initialIndex}
      />
    </>
  );
};

export default AttachmentListEditor;
