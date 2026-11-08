import { Button, Tooltip } from "@usememos/ui";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  FileAudioIcon,
  FileIcon,
  FileTextIcon,
  ImagePlusIcon,
  PauseIcon,
  PencilLineIcon,
  PlayIcon,
  XIcon,
} from "lucide-react";
import { type FC, type MouseEvent, useMemo, useRef, useState } from "react";
import { isDrawingFilename } from "@/components/DrawingSheet";
import type { AttachmentItem, DrawingSource, LocalFile } from "@/components/MemoEditor/edit/types/attachment";
import { getAudioRecordingTimeLabel, toAttachmentItems } from "@/components/MemoEditor/edit/types/attachment";
import MetadataSection, {
  METADATA_ROW_BOX_CLASSES,
  METADATA_ROW_CONTENT_TEXT_CLASSES,
  METADATA_ROW_CONTROLS_CLASSES,
  METADATA_ROW_SLOT_BUTTON_CLASSES,
  METADATA_ROW_SLOT_CLASSES,
  MetadataRowDetail,
} from "@/components/MemoMetadata/MetadataSection";
import PreviewImageDialog from "@/components/PreviewImageDialog";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";
import { useTranslate } from "@/utils/i18n";
import { canInlineAttachment, extractAttachmentUIDFromName } from "@/utils/managed-attachment";
import type { PreviewMediaItem } from "@/utils/media-item";
import { formatAudioTime, toggleAudioPlayback } from "./attachmentHelpers";

const collectMembers = <T,>(byId: ReadonlyMap<string, T>, memberIds: string[]): T[] =>
  memberIds.map((memberId) => byId.get(memberId)).filter((member): member is T => member !== undefined);

interface AttachmentListEditorProps {
  onTranscribeAttachment?: (attachment: Attachment) => void;
  transcribingAttachment?: string;
  transcriptionDisabled?: boolean;
  attachments: Attachment[];
  localFiles?: LocalFile[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  onLocalFilesChange?: (localFiles: LocalFile[]) => void;
  onRemoveLocalFile?: (previewUrl: string) => void;
  inlineAttachmentUIDs?: ReadonlySet<string>;
  onInsertAttachments?: (attachments: Attachment[]) => void;
  onInsertLocalFiles?: (localFiles: LocalFile[]) => void;
  placementActionsDisabled?: boolean;
  uploadingLocalFileURLs?: ReadonlySet<string>;
  /** Opens a drawing (a `.canvas.png` image) in the drawing sheet. */
  onEditDrawing?: (source: DrawingSource) => void;
  /** The row whose drawing is being opened. */
  openingDrawing?: string;
}

interface RowAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}

/** Trailing controls of an attachment row: quiet 24px squares that show once the row is engaged. */
const AttachmentItemActions: FC<{
  transcriptionAction?: { label: string; onClick: () => void; disabled: boolean; busy: boolean };
  drawingAction?: RowAction;
  placementAction?: { label: string; onClick: () => void; disabled?: boolean };
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}> = ({ transcriptionAction, drawingAction, placementAction, onRemove, onMoveUp, onMoveDown, canMoveUp = true, canMoveDown = true }) => {
  const t = useTranslate();
  // A drawing row already carries Insert image; on narrow rows its edit action keeps only the glyph.
  const isWide = useMediaQuery("md");
  const stopPropagation = (event: MouseEvent) => {
    event.stopPropagation();
  };
  const drawingButton = drawingAction && (
    <Button
      variant="ghost"
      size={isWide ? "sm" : "xs"}
      disabled={drawingAction.disabled}
      loading={drawingAction.busy}
      loadingLabel={drawingAction.label}
      onClick={(event) => {
        stopPropagation(event);
        drawingAction.onClick();
      }}
      aria-label={isWide ? undefined : drawingAction.label}
      icon={<PencilLineIcon />}
    >
      {isWide ? drawingAction.label : undefined}
    </Button>
  );

  return (
    <div className={METADATA_ROW_CONTROLS_CLASSES}>
      {transcriptionAction && (
        <Button
          variant="ghost"
          size="sm"
          disabled={transcriptionAction.disabled}
          loading={transcriptionAction.busy}
          loadingLabel={transcriptionAction.label}
          onClick={(event) => {
            stopPropagation(event);
            transcriptionAction.onClick();
          }}
          icon={<FileTextIcon />}
        >
          {transcriptionAction.label}
        </Button>
      )}
      {drawingButton &&
        (isWide ? (
          drawingButton
        ) : (
          <Tooltip.Root>
            <Tooltip.Trigger render={drawingButton} />
            <Tooltip.Popup>{drawingAction?.label}</Tooltip.Popup>
          </Tooltip.Root>
        ))}
      {placementAction && (
        <Button
          variant="ghost"
          size="sm"
          onClick={(event) => {
            stopPropagation(event);
            placementAction.onClick();
          }}
          disabled={placementAction.disabled}
          icon={<ImagePlusIcon />}
        >
          {placementAction.label}
        </Button>
      )}
      {onMoveUp && (
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Button
                variant="ghost"
                size="xs"
                onClick={(event) => {
                  stopPropagation(event);
                  onMoveUp();
                }}
                disabled={!canMoveUp}
                aria-label={t("editor.attachments.move-up")}
                icon={<ChevronUpIcon />}
              />
            }
          />
          <Tooltip.Popup>{t("editor.attachments.move-up")}</Tooltip.Popup>
        </Tooltip.Root>
      )}

      {onMoveDown && (
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Button
                variant="ghost"
                size="xs"
                onClick={(event) => {
                  stopPropagation(event);
                  onMoveDown();
                }}
                disabled={!canMoveDown}
                aria-label={t("editor.attachments.move-down")}
                icon={<ChevronDownIcon />}
              />
            }
          />
          <Tooltip.Popup>{t("editor.attachments.move-down")}</Tooltip.Popup>
        </Tooltip.Root>
      )}

      {onRemove && (
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Button
                variant="ghost"
                size="xs"
                onClick={(event) => {
                  stopPropagation(event);
                  onRemove();
                }}
                aria-label={t("editor.attachments.remove")}
                icon={<XIcon />}
              />
            }
          />
          <Tooltip.Popup>{t("editor.attachments.remove")}</Tooltip.Popup>
        </Tooltip.Root>
      )}
    </div>
  );
};

const AttachmentItemCard: FC<{
  transcriptionAction?: { label: string; onClick: () => void; disabled: boolean; busy: boolean };
  drawingAction?: RowAction;
  item: AttachmentItem;
  onPreview?: () => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isUploadingInline?: boolean;
  placementAction?: { label: string; onClick: () => void; disabled?: boolean };
}> = ({
  item,
  onPreview,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  isUploadingInline,
  placementAction,
  transcriptionAction,
  drawingAction,
}) => {
  const t = useTranslate();
  const { category, filename, thumbnailUrl, mimeType, size, sourceUrl, isVoiceNote, audioMeta } = item;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const fileTypeLabel = item.category === "motion" ? t("attachment-library.labels.live-photo") : getFileTypeLabel(mimeType);
  const isPreviewable = category === "image" || category === "video" || category === "motion";
  const recordingTimeLabel = isVoiceNote ? getAudioRecordingTimeLabel(filename) : undefined;
  const titleLabel =
    isVoiceNote && recordingTimeLabel
      ? t("editor.audio-recorder.attachment-label-with-time", { time: recordingTimeLabel })
      : isVoiceNote
        ? t("editor.audio-recorder.attachment-label")
        : filename;
  const detailParts = [
    isUploadingInline ? t("editor.insert-menu.uploading-inline-image") : undefined,
    audioMeta?.durationSeconds ? formatAudioTime(audioMeta.durationSeconds) : undefined,
    fileTypeLabel,
    size ? formatFileSize(size) : undefined,
  ];

  const handleAudioToggle = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    await toggleAudioPlayback(audio, sourceUrl, () => setIsPlaying(false));
  };

  return (
    <div className={METADATA_ROW_BOX_CLASSES} aria-busy={isUploadingInline || undefined}>
      <div className={cn(METADATA_ROW_SLOT_CLASSES, "relative overflow-hidden rounded-[5px] bg-mu-well/40")}>
        {(category === "image" || category === "motion") && thumbnailUrl ? (
          <div
            onClick={(event) => {
              event.stopPropagation();
              onPreview?.();
            }}
            className={cn("size-full overflow-hidden", isPreviewable ? "cursor-pointer" : "cursor-default")}
            aria-label={t("common.preview-name", { name: filename })}
          >
            <img src={thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
          </div>
        ) : isVoiceNote ? (
          <>
            <button
              type="button"
              onClick={handleAudioToggle}
              className={METADATA_ROW_SLOT_BUTTON_CLASSES}
              aria-pressed={isPlaying}
              aria-label={isPlaying ? t("editor.audio-recorder.pause-recording") : t("editor.audio-recorder.play-recording")}
            >
              {isPlaying ? <PauseIcon className="mu-icon-sm" /> : <PlayIcon className="mu-icon-sm translate-x-[0.5px]" />}
            </button>
            <audio
              ref={audioRef}
              preload="none"
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
            className={METADATA_ROW_SLOT_BUTTON_CLASSES}
            aria-label={t("common.preview-name", { name: filename })}
          >
            <PlayIcon className="mu-icon-sm translate-x-[0.5px]" />
          </button>
        ) : category === "audio" ? (
          <FileAudioIcon className="mu-icon-sm text-mu-ink-muted" />
        ) : (
          <FileIcon className="mu-icon-sm text-mu-ink-muted" />
        )}
        {category === "motion" && (
          <span className="absolute inset-x-0 bottom-0 bg-black/70 text-center text-[7px] font-medium uppercase tracking-wide text-white">
            {t("attachment-library.labels.live")}
          </span>
        )}
      </div>

      <span className={METADATA_ROW_CONTENT_TEXT_CLASSES} title={filename}>
        {titleLabel}
      </span>

      <MetadataRowDetail parts={detailParts} />

      <AttachmentItemActions
        transcriptionAction={transcriptionAction}
        drawingAction={drawingAction}
        placementAction={placementAction}
        onRemove={onRemove}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />
    </div>
  );
};

const AttachmentListEditor: FC<AttachmentListEditorProps> = ({
  attachments,
  localFiles = [],
  onAttachmentsChange,
  onLocalFilesChange,
  onRemoveLocalFile,
  inlineAttachmentUIDs = new Set(),
  onInsertAttachments,
  onInsertLocalFiles,
  placementActionsDisabled = false,
  uploadingLocalFileURLs = new Set(),
  onTranscribeAttachment,
  transcribingAttachment,
  transcriptionDisabled = false,
  onEditDrawing,
  openingDrawing,
}) => {
  const t = useTranslate();
  const [previewState, setPreviewState] = useState<{ open: boolean; initialIndex: number }>({ open: false, initialIndex: 0 });
  const attachmentsByName = useMemo(() => new Map(attachments.map((attachment) => [attachment.name, attachment])), [attachments]);
  const allItems = toAttachmentItems(attachments, localFiles);
  // Saved drawings with an edit waiting to upload over them: the edit's row stands in for them.
  const replacedAttachmentNames = new Set(localFiles.flatMap((localFile) => (localFile.replaces ? [localFile.replaces] : [])));
  const isHiddenItem = (item: AttachmentItem) =>
    !item.isLocal &&
    collectMembers(attachmentsByName, item.memberIds).some((attachment) => {
      if (replacedAttachmentNames.has(attachment.name)) return true;
      const uid = extractAttachmentUIDFromName(attachment.name);
      return uid ? inlineAttachmentUIDs.has(uid) : false;
    });
  // A managed image already has its placement represented in Markdown. Keep
  // the attachment bound to the memo, but do not repeat its logical media group
  // in the attachment section. Removing the Markdown reference makes it
  // visible here again on the next render. A replaced drawing stays bound too,
  // and shows again if its pending edit is removed.
  const items = allItems.filter((item) => !isHiddenItem(item));
  const allAttachmentItems = allItems.filter((item) => !item.isLocal);
  const attachmentItems = items.filter((item) => !item.isLocal);
  const localItems = items.filter((item) => item.isLocal);
  const previewItems = useMemo<PreviewMediaItem[]>(
    () =>
      items.reduce<PreviewMediaItem[]>((acc, item) => {
        const itemAttachments = item.isLocal ? undefined : collectMembers(attachmentsByName, item.memberIds);
        if (item.category === "image") {
          acc.push({
            id: item.id,
            kind: "image",
            sourceUrl: item.sourceUrl,
            posterUrl: item.thumbnailUrl,
            filename: item.filename,
            attachments: itemAttachments,
          });
          return acc;
        }

        if (item.category === "video") {
          acc.push({
            id: item.id,
            kind: "video",
            sourceUrl: item.sourceUrl,
            posterUrl: item.thumbnailUrl,
            filename: item.filename,
            attachments: itemAttachments,
          });
          return acc;
        }

        if (item.category === "motion") {
          acc.push({
            id: item.id,
            kind: "motion",
            motionUrl: item.sourceUrl,
            posterUrl: item.thumbnailUrl,
            filename: item.filename,
            attachments: itemAttachments,
          });
          return acc;
        }

        return acc;
      }, []),
    [attachmentsByName, items],
  );

  // Items address their members by id, so index once instead of re-scanning both
  // source arrays for every item on every render.
  const localFilesByPreviewUrl = useMemo(() => new Map(localFiles.map((localFile) => [localFile.previewUrl, localFile])), [localFiles]);

  const handleMoveAttachments = (itemId: string, direction: -1 | 1) => {
    if (!onAttachmentsChange) return;

    const itemIndex = attachmentItems.findIndex((item) => item.id === itemId);
    const targetIndex = itemIndex + direction;
    if (itemIndex < 0 || targetIndex < 0 || targetIndex >= attachmentItems.length) {
      return;
    }

    const reorderedItems = [...attachmentItems];
    [reorderedItems[itemIndex], reorderedItems[targetIndex]] = [reorderedItems[targetIndex], reorderedItems[itemIndex]];

    let visibleIndex = 0;
    const mergedItems = allAttachmentItems.map((item) => (isHiddenItem(item) ? item : reorderedItems[visibleIndex++]!));
    onAttachmentsChange(mergedItems.flatMap((item) => collectMembers(attachmentsByName, item.memberIds)));
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

    onLocalFilesChange(reorderedItems.flatMap((item) => collectMembers(localFilesByPreviewUrl, item.memberIds)));
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
      <MetadataSection title={t("common.attachments")}>
        {items.map((item) => {
          const itemList = item.isLocal ? localItems : attachmentItems;
          const itemIndex = itemList.findIndex((entry) => entry.id === item.id);
          const itemAttachments = collectMembers(attachmentsByName, item.memberIds);
          const itemLocalFiles = collectMembers(localFilesByPreviewUrl, item.memberIds);
          const isUploadingInline = item.isLocal && item.memberIds.some((memberID) => uploadingLocalFileURLs.has(memberID));
          const isTranscribing = item.id === transcribingAttachment;
          // External links are fetched cross-origin by the browser, which most hosts refuse.
          const transcribableAttachment =
            !item.isLocal && item.category === "audio" && !itemAttachments[0]?.externalLink ? itemAttachments[0] : undefined;
          const transcriptionAction =
            transcribableAttachment && onTranscribeAttachment
              ? {
                  label: t(isTranscribing ? "editor.audio-recorder.transcribing" : "editor.audio-recorder.transcribe"),
                  onClick: () => onTranscribeAttachment(transcribableAttachment),
                  disabled: transcriptionDisabled || Boolean(transcribingAttachment),
                  busy: isTranscribing,
                }
              : undefined;
          // A drawing opens from the original file: a saved one is downloaded, so it must live on this server.
          const drawingSource: DrawingSource | undefined =
            item.category !== "image" || !isDrawingFilename(item.filename)
              ? undefined
              : item.isLocal
                ? itemLocalFiles[0] && { kind: "local", localFile: itemLocalFiles[0] }
                : itemAttachments[0] && !itemAttachments[0].externalLink
                  ? { kind: "attachment", attachment: itemAttachments[0] }
                  : undefined;
          const isOpeningDrawing = openingDrawing !== undefined && item.memberIds.includes(openingDrawing);
          const drawingAction =
            drawingSource && onEditDrawing
              ? {
                  label: t("editor.drawing.edit"),
                  onClick: () => onEditDrawing(drawingSource),
                  disabled: placementActionsDisabled || Boolean(openingDrawing),
                  busy: isOpeningDrawing,
                }
              : undefined;
          // Inserting uploads at once, so a pending edit of a saved drawing would overwrite it before the memo is saved.
          const isPendingReplacement = itemLocalFiles.some((localFile) => localFile.replaces);
          const canInsert =
            (item.category === "image" || item.category === "motion") &&
            (item.isLocal ? !isPendingReplacement : itemAttachments.some(canInlineAttachment));
          const placementAction = canInsert
            ? {
                label: t("editor.insert-menu.insert-image"),
                onClick: () =>
                  item.isLocal ? onInsertLocalFiles?.(itemLocalFiles) : onInsertAttachments?.(itemAttachments.filter(canInlineAttachment)),
                disabled: placementActionsDisabled,
              }
            : undefined;

          return (
            <AttachmentItemCard
              key={item.id}
              item={item}
              isUploadingInline={isUploadingInline}
              placementAction={placementAction}
              transcriptionAction={transcriptionAction}
              drawingAction={drawingAction}
              onPreview={
                item.category === "image" || item.category === "video" || item.category === "motion"
                  ? () => handlePreviewItem(item)
                  : undefined
              }
              onRemove={isUploadingInline || isTranscribing ? undefined : () => handleRemoveItem(item)}
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
