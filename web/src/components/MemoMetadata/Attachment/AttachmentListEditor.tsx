import { Button, Menu, Spinner, Tooltip } from "@usememos/ui";
import {
  EllipsisIcon,
  FileAudioIcon,
  FileIcon,
  FileTextIcon,
  GripVerticalIcon,
  ImagePlusIcon,
  PauseIcon,
  PencilLineIcon,
  PlayIcon,
  XIcon,
} from "lucide-react";
import {
  type FC,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { DRAWING_PAPER, isDrawingFilename } from "@/components/DrawingSheet";
import type { AttachmentItem, DrawingSource, LocalFile } from "@/components/MemoEditor/edit/types/attachment";
import {
  getAudioRecordingTimeLabel,
  isMediaItem,
  separateMediaAndDocs,
  toAttachmentItems,
} from "@/components/MemoEditor/edit/types/attachment";
import { effectiveOrder, localFileOrderKey, moveGroup, sortByOrder } from "@/components/MemoEditor/edit/utils/attachmentOrder";
import {
  METADATA_ROW_BOX_CLASSES,
  METADATA_ROW_CONTENT_TEXT_CLASSES,
  METADATA_ROW_CONTROLS_CLASSES,
  METADATA_ROW_LIST_CLASSES,
  METADATA_ROW_SLOT_BUTTON_CLASSES,
  METADATA_ROW_SLOT_CLASSES,
  MetadataRowDetail,
} from "@/components/MemoMetadata/MetadataSection";
import PreviewImageDialog from "@/components/PreviewImageDialog";
import VideoPoster from "@/components/VideoPoster";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";
import { useTranslate } from "@/utils/i18n";
import { canInlineAttachment, extractAttachmentUIDFromName } from "@/utils/managed-attachment";
import type { PreviewMediaItem } from "@/utils/media-item";
import { formatAudioTime, toggleAudioPlayback } from "./attachmentHelpers";
import { COVER_MEDIA_CLASS, DRAWING_SHEET_CELL_MEDIA_CLASS, TILE_BADGE_CLASS, VISUAL_TILE_BUTTON_CLASS } from "./attachmentVisualClasses";
import { previewOrder, useDragReorder } from "./useDragReorder";
import { resolveEditorGalleryLayout } from "./visualGalleryLayout";

const collectMembers = <T,>(byId: ReadonlyMap<string, T>, memberIds: string[]): T[] =>
  memberIds.map((memberId) => byId.get(memberId)).filter((member): member is T => member !== undefined);

/** A dragged tile's place in the shown order: an empty dashed slot the item will settle into. */
const TILE_PLACEHOLDER_CLASS = "border-dashed border-mu-edge bg-mu-well/50 shadow-none [&>*]:invisible";
/** The same for a row: an outlined, empty row. */
const ROW_PLACEHOLDER_CLASS = "bg-transparent shadow-[inset_0_0_0_1px_var(--mu-edge)] hover:bg-transparent [&>*]:invisible";
/** The lifted copy that follows the pointer while an item is dragged. */
const GHOST_CLASS = "pointer-events-none fixed start-0 top-0 z-(--mu-layer-popup) overflow-hidden rounded-mu-md shadow-mu-pop [scale:1.03]";

/** The attributes a reorderable item carries for `useDragReorder`. */
interface ReorderAttributes {
  "data-reorder-position": number;
  "data-reorder-key": string;
  "data-reorder-placeholder"?: boolean;
}

interface AttachmentListEditorProps {
  onTranscribeAttachment?: (attachment: Attachment) => void;
  transcribingAttachment?: string;
  transcriptionDisabled?: boolean;
  attachments: Attachment[];
  localFiles?: LocalFile[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  onLocalFilesChange?: (localFiles: LocalFile[]) => void;
  onRemoveLocalFile?: (previewUrl: string) => void;
  /** The draft's order of saved attachments and new files (see `attachmentOrder`). */
  order?: string[];
  onOrderChange?: (order: string[]) => void;
  inlineAttachmentUIDs?: ReadonlySet<string>;
  onInsertAttachments?: (attachments: Attachment[]) => void;
  onInsertLocalFiles?: (localFiles: LocalFile[]) => void;
  placementActionsDisabled?: boolean;
  uploadingLocalFileURLs?: ReadonlySet<string>;
  /** Opens a drawing (a `.canvas.png` image) in the drawing sheet. */
  onEditDrawing?: (source: DrawingSource) => void;
  /** The row whose drawing is being opened. */
  openingDrawing?: string;
  /** Rows that follow the attachments in the same list: the draft's links and place. */
  children?: ReactNode;
}

interface ItemAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}

interface ItemActions {
  /** Inserts the image into the text. */
  placement?: ItemAction;
  drawing?: ItemAction;
  transcription?: ItemAction;
  onRemove?: () => void;
  onPreview?: () => void;
  isUploadingInline: boolean;
  /** "New" for a file not saved yet, "Edited" for an edit waiting to replace a saved drawing. */
  badge?: string;
}

const stop = (event: MouseEvent) => event.stopPropagation();

/** A 24px dark key over a photo, labelled by its tooltip. */
const TileKey = ({ icon, action }: { icon: ReactElement; action: ItemAction }) => (
  <Tooltip.Root>
    <Tooltip.Trigger
      render={
        <Button
          variant="neutral"
          size="sm"
          icon={icon}
          aria-label={action.label}
          disabled={action.disabled}
          loading={action.busy}
          loadingLabel={action.label}
          onClick={(event) => {
            stop(event);
            action.onClick();
          }}
        />
      }
    />
    <Tooltip.Popup>{action.label}</Tooltip.Popup>
  </Tooltip.Root>
);

/** A tile's picture: a drawing on its paper, a video's poster, or the image itself. */
const TileMedia = ({ item }: { item: AttachmentItem }) =>
  item.category === "image" && isDrawingFilename(item.filename) ? (
    <img src={item.sourceUrl} alt="" className={DRAWING_SHEET_CELL_MEDIA_CLASS} draggable={false} loading="lazy" decoding="async" />
  ) : item.category === "video" ? (
    <VideoPoster sourceUrl={item.sourceUrl} posterUrl={item.isLocal ? undefined : item.thumbnailUrl} alt="" className={COVER_MEDIA_CLASS} />
  ) : (
    <img src={item.thumbnailUrl} alt="" className={COVER_MEDIA_CLASS} draggable={false} loading="lazy" decoding="async" />
  );

/**
 * One image, video or drawing in the gallery. The tile opens the preview and drags to reorder;
 * its actions are dark keys in the corner that show on hover or focus. On touch screens, which
 * have no hover, one "More" key holds the same actions.
 */
const AttachmentTile: FC<{
  item: AttachmentItem;
  actions: ItemActions;
  className?: string;
  /** A drawing alone in the gallery is a raised sheet, as in the saved memo; among others it is framed like them. */
  alone: boolean;
  /** The tile is being dragged: its place shows as an empty slot while a lifted copy follows the pointer. */
  placeholder: boolean;
  dragProps: ReorderAttributes & {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  };
}> = ({ item, actions, className, alone, placeholder, dragProps }) => {
  const t = useTranslate();
  const drawing = item.category === "image" && isDrawingFilename(item.filename);
  const keyActions: { icon: ReactElement; action: ItemAction }[] = [
    ...(actions.drawing ? [{ icon: <PencilLineIcon />, action: actions.drawing }] : []),
    ...(actions.placement ? [{ icon: <ImagePlusIcon />, action: actions.placement }] : []),
    ...(actions.onRemove ? [{ icon: <XIcon />, action: { label: t("editor.attachments.remove"), onClick: actions.onRemove } }] : []),
  ];

  return (
    // A tile is a div, not a <button>: it holds block media and its own controls.
    <div
      {...dragProps}
      role="button"
      tabIndex={0}
      aria-label={t("common.preview-name", { name: item.filename })}
      aria-busy={actions.isUploadingInline || undefined}
      className={cn(
        VISUAL_TILE_BUTTON_CLASS,
        "group/tile h-full min-h-0 touch-manipulation cursor-grab select-none [-webkit-touch-callout:none]",
        drawing && alone && "border-0 shadow-mu-raised",
        placeholder && TILE_PLACEHOLDER_CLASS,
        className,
      )}
      style={drawing && !placeholder ? { background: DRAWING_PAPER } : undefined}
      onClick={actions.onPreview}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          actions.onPreview?.();
          return;
        }
        // Alt + arrows reorder, so plain arrows keep scrolling the page.
        if (event.altKey) dragProps.onKeyDown(event);
      }}
    >
      <TileMedia item={item} />

      {item.category === "motion" && <span className={cn(TILE_BADGE_CLASS, "start-2 top-2")}>{t("attachment-library.labels.live")}</span>}
      {actions.badge && <span className={cn(TILE_BADGE_CLASS, "bottom-2 start-2")}>{actions.badge}</span>}
      {actions.isUploadingInline && (
        <div className="absolute inset-0 flex items-center justify-center bg-mu-surface/40 text-mu-ink">
          <Spinner label={t("editor.insert-menu.uploading-inline-image")} />
        </div>
      )}

      {keyActions.length > 0 && (
        // Controls over a photo are dark keys in every theme.
        <div data-theme="dark" className="absolute end-2 top-2 flex gap-1">
          <div className="flex gap-1 opacity-0 transition-opacity group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 pointer-coarse:hidden">
            {keyActions.map(({ icon, action }) => (
              <TileKey key={action.label} icon={icon} action={action} />
            ))}
          </div>
          <div className="hidden pointer-coarse:flex">
            <Menu.Root modal={false} size="sm">
              <Menu.Trigger
                render={<Button variant="neutral" size="sm" icon={<EllipsisIcon />} aria-label={t("common.more")} onClick={stop} />}
              />
              <Menu.Popup align="end">
                {keyActions.map(({ icon, action }) => (
                  <Menu.Item key={action.label} icon={icon} disabled={action.disabled} onClick={action.onClick}>
                    {action.label}
                  </Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Root>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * An audio or file attachment as a metadata row. Its actions are 24px ghost buttons that
 * overlay the details once the row is engaged; the grip drags it, or moves it with the arrow keys.
 */
const AttachmentRow: FC<{
  item: AttachmentItem;
  actions: ItemActions;
  canReorder: boolean;
  placeholder: boolean;
  rowProps: ReorderAttributes & { onPointerDown: (event: PointerEvent<HTMLElement>) => void };
  onGripKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}> = ({ item, actions, canReorder, placeholder, rowProps, onGripKeyDown }) => {
  const t = useTranslate();
  const { category, filename, mimeType, size, sourceUrl, isVoiceNote, audioMeta } = item;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const recordingTimeLabel = isVoiceNote ? getAudioRecordingTimeLabel(filename) : undefined;
  const titleLabel =
    isVoiceNote && recordingTimeLabel
      ? t("editor.audio-recorder.attachment-label-with-time", { time: recordingTimeLabel })
      : isVoiceNote
        ? t("editor.audio-recorder.attachment-label")
        : filename;
  const detailParts = [
    actions.badge,
    audioMeta?.durationSeconds ? formatAudioTime(audioMeta.durationSeconds) : undefined,
    getFileTypeLabel(mimeType),
    size ? formatFileSize(size) : undefined,
  ];

  const handleAudioToggle = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    await toggleAudioPlayback(audio, sourceUrl, () => setIsPlaying(false));
  };

  return (
    <div {...rowProps} className={cn(METADATA_ROW_BOX_CLASSES, canReorder && "md:cursor-grab", placeholder && ROW_PLACEHOLDER_CLASS)}>
      <div className={METADATA_ROW_SLOT_CLASSES}>
        {isVoiceNote ? (
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
        ) : category === "audio" ? (
          <FileAudioIcon className="mu-icon-sm text-mu-ink-muted" />
        ) : (
          <FileIcon className="mu-icon-sm text-mu-ink-muted" />
        )}
      </div>

      <span className={METADATA_ROW_CONTENT_TEXT_CLASSES} title={filename}>
        {titleLabel}
      </span>

      <MetadataRowDetail parts={detailParts} />

      <div className={METADATA_ROW_CONTROLS_CLASSES}>
        {actions.transcription && (
          <Button
            variant="ghost"
            size="sm"
            disabled={actions.transcription.disabled}
            loading={actions.transcription.busy}
            loadingLabel={actions.transcription.label}
            onClick={(event) => {
              stop(event);
              actions.transcription?.onClick();
            }}
            icon={<FileTextIcon />}
          >
            {actions.transcription.label}
          </Button>
        )}
        {actions.onRemove && (
          <Tooltip.Root>
            <Tooltip.Trigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    stop(event);
                    actions.onRemove?.();
                  }}
                  aria-label={t("editor.attachments.remove")}
                  icon={<XIcon />}
                />
              }
            />
            <Tooltip.Popup>{t("editor.attachments.remove")}</Tooltip.Popup>
          </Tooltip.Root>
        )}
        {canReorder && (
          <Tooltip.Root>
            <Tooltip.Trigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  data-reorder-handle
                  className="cursor-grab touch-none"
                  aria-label={t("editor.attachments.reorder", { name: titleLabel })}
                  onKeyDown={onGripKeyDown}
                  icon={<GripVerticalIcon />}
                />
              }
            />
            <Tooltip.Popup>{t("editor.attachments.reorder-hint")}</Tooltip.Popup>
          </Tooltip.Root>
        )}
      </div>
    </div>
  );
};

/**
 * The draft's attachments: images, videos and drawings as the saved memo's gallery (at the
 * composer's height), then audio and files as rows in one list with the draft's links and place.
 * Saved attachments and new files share one order; dragging a tile or a row's grip changes it.
 */
const AttachmentListEditor: FC<AttachmentListEditorProps> = ({
  attachments,
  localFiles = [],
  onAttachmentsChange,
  onLocalFilesChange,
  onRemoveLocalFile,
  order = [],
  onOrderChange,
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
  children,
}) => {
  const t = useTranslate();
  const [previewState, setPreviewState] = useState<{ open: boolean; initialIndex: number }>({ open: false, initialIndex: 0 });
  const attachmentsByName = useMemo(() => new Map(attachments.map((attachment) => [attachment.name, attachment])), [attachments]);
  // Items address their members by id, so index once instead of re-scanning both
  // source arrays for every item on every render.
  const localFilesByPreviewUrl = useMemo(() => new Map(localFiles.map((localFile) => [localFile.previewUrl, localFile])), [localFiles]);
  const keysOf = (item: AttachmentItem) =>
    item.isLocal ? collectMembers(localFilesByPreviewUrl, item.memberIds).map(localFileOrderKey) : item.memberIds;
  const allItems = sortByOrder(toAttachmentItems(attachments, localFiles), keysOf, effectiveOrder(order, attachments, localFiles));
  // Saved drawings with an edit waiting to upload over them: the edit stands in for them.
  const replacedAttachmentNames = new Set(localFiles.flatMap((localFile) => (localFile.replaces ? [localFile.replaces] : [])));
  // A managed image already has its placement represented in Markdown. Keep
  // the attachment bound to the memo, but do not repeat its logical media group
  // here. Removing the Markdown reference makes it visible again on the next
  // render. A replaced drawing stays bound too, and shows again if its pending
  // edit is removed.
  const isReplaced = (item: AttachmentItem) =>
    !item.isLocal && collectMembers(attachmentsByName, item.memberIds).some((attachment) => replacedAttachmentNames.has(attachment.name));
  const isHiddenItem = (item: AttachmentItem) =>
    isReplaced(item) ||
    (!item.isLocal &&
      collectMembers(attachmentsByName, item.memberIds).some((attachment) => {
        const uid = extractAttachmentUIDFromName(attachment.name);
        return uid ? inlineAttachmentUIDs.has(uid) : false;
      }));
  const { media: visualItems, docs: rowItems } = separateMediaAndDocs(allItems.filter((item) => !isHiddenItem(item)));

  const previewItems = useMemo<PreviewMediaItem[]>(
    () =>
      visualItems.map((item): PreviewMediaItem => {
        const itemAttachments = item.isLocal ? undefined : collectMembers(attachmentsByName, item.memberIds);
        if (item.category === "motion") {
          return {
            id: item.id,
            kind: "motion",
            motionUrl: item.sourceUrl,
            posterUrl: item.thumbnailUrl,
            filename: item.filename,
            attachments: itemAttachments,
          };
        }
        return {
          id: item.id,
          kind: item.category === "video" ? "video" : "image",
          sourceUrl: item.sourceUrl,
          posterUrl: item.thumbnailUrl,
          filename: item.filename,
          attachments: itemAttachments,
        };
      }),
    [attachmentsByName, visualItems],
  );

  // Moving within the gallery or the rows reorders the whole draft: the item takes its target's
  // place among every attachment, hidden ones included, so their order is kept too.
  // A saved drawing with a pending edit is left out: the edit holds its key and its place.
  const orderedItems = allItems.filter((item) => !isReplaced(item));
  const moveWithin = (list: AttachmentItem[]) => (from: number, to: number) => {
    const fromIndex = orderedItems.indexOf(list[from]);
    const toIndex = orderedItems.indexOf(list[to]);
    if (fromIndex < 0 || toIndex < 0) return;
    onOrderChange?.(moveGroup(orderedItems.map(keysOf), fromIndex, toIndex));
  };
  const galleryDrag = useDragReorder(visualItems.length, moveWithin(visualItems));
  const rowDrag = useDragReorder(rowItems.length, moveWithin(rowItems));
  // While an item is dragged, the list shows the order it would drop into.
  const shownVisualItems = previewOrder(visualItems, galleryDrag.dragging, galleryDrag.over);
  const shownRowItems = previewOrder(rowItems, rowDrag.dragging, rowDrag.over);
  const draggedTile = galleryDrag.dragging !== null ? visualItems[galleryDrag.dragging] : undefined;
  const draggedRow = rowDrag.dragging !== null ? rowItems[rowDrag.dragging] : undefined;

  const handleRemoveItem = (item: AttachmentItem) => {
    if (item.isLocal) {
      const nextLocalFiles = localFiles.filter((file) => !item.memberIds.includes(file.previewUrl));
      onLocalFilesChange?.(nextLocalFiles);
      if (!onLocalFilesChange) {
        item.memberIds.forEach((previewUrl) => onRemoveLocalFile?.(previewUrl));
      }
      return;
    }
    onAttachmentsChange?.(attachments.filter((attachment) => !item.memberIds.includes(attachment.name)));
  };

  const actionsFor = (item: AttachmentItem): ItemActions => {
    const itemAttachments = collectMembers(attachmentsByName, item.memberIds);
    const itemLocalFiles = collectMembers(localFilesByPreviewUrl, item.memberIds);
    const isUploadingInline = item.isLocal && item.memberIds.some((memberID) => uploadingLocalFileURLs.has(memberID));
    const isTranscribing = item.id === transcribingAttachment;
    const isPendingReplacement = itemLocalFiles.some((localFile) => localFile.replaces);

    // External links are fetched cross-origin by the browser, which most hosts refuse.
    const transcribableAttachment =
      !item.isLocal && item.category === "audio" && !itemAttachments[0]?.externalLink ? itemAttachments[0] : undefined;
    const transcription =
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
    const drawing =
      drawingSource && onEditDrawing
        ? {
            label: t("editor.drawing.edit"),
            onClick: () => onEditDrawing(drawingSource),
            disabled: placementActionsDisabled || Boolean(openingDrawing),
            busy: openingDrawing !== undefined && item.memberIds.includes(openingDrawing),
          }
        : undefined;

    // Inserting uploads at once, so a pending edit of a saved drawing would overwrite it before the memo is saved.
    const canInsert =
      (item.category === "image" || item.category === "motion") &&
      (item.isLocal ? !isPendingReplacement : itemAttachments.some(canInlineAttachment));
    const placement = canInsert
      ? {
          label: t("editor.insert-menu.insert-image"),
          onClick: () =>
            item.isLocal ? onInsertLocalFiles?.(itemLocalFiles) : onInsertAttachments?.(itemAttachments.filter(canInlineAttachment)),
          disabled: placementActionsDisabled,
        }
      : undefined;

    return {
      placement,
      drawing,
      transcription,
      isUploadingInline,
      onRemove: isUploadingInline || isTranscribing ? undefined : () => handleRemoveItem(item),
      onPreview: isMediaItem(item)
        ? () => {
            const previewIndex = previewItems.findIndex((previewItem) => previewItem.id === item.id);
            if (previewIndex >= 0) setPreviewState({ open: true, initialIndex: previewIndex });
          }
        : undefined,
      badge: !item.isLocal ? undefined : isPendingReplacement ? t("editor.attachments.edited") : t("editor.attachments.new"),
    };
  };

  const canReorder = Boolean(onOrderChange);
  const gallery = resolveEditorGalleryLayout(visualItems.length);
  const hasRows = rowItems.length > 0 || Boolean(children);

  if (visualItems.length === 0 && !hasRows) {
    return null;
  }

  return (
    <>
      {visualItems.length > 0 && (
        <div
          ref={galleryDrag.containerRef}
          className={cn("w-full", gallery.containerClassName)}
          onClickCapture={galleryDrag.clickCapture}
          aria-label={t("common.attachments")}
          role="group"
        >
          {shownVisualItems.map((item, position) => {
            const index = visualItems.indexOf(item);
            const placeholder = galleryDrag.dragging === index;
            return (
              <AttachmentTile
                key={item.id}
                item={item}
                actions={actionsFor(item)}
                className={gallery.cellClassName(position)}
                alone={visualItems.length === 1}
                placeholder={placeholder}
                dragProps={{
                  "data-reorder-position": position,
                  "data-reorder-key": item.id,
                  "data-reorder-placeholder": placeholder || undefined,
                  onPointerDown: canReorder ? galleryDrag.pointerDown(index, { longPress: true }) : () => undefined,
                  onKeyDown: canReorder ? galleryDrag.keyDown(index) : () => undefined,
                }}
              />
            );
          })}
        </div>
      )}

      {hasRows && (
        <div ref={rowDrag.containerRef} className={METADATA_ROW_LIST_CLASSES} onClickCapture={rowDrag.clickCapture}>
          {shownRowItems.map((item, position) => {
            const index = rowItems.indexOf(item);
            const placeholder = rowDrag.dragging === index;
            return (
              <AttachmentRow
                key={item.id}
                item={item}
                actions={actionsFor(item)}
                canReorder={canReorder && rowItems.length > 1}
                placeholder={placeholder}
                rowProps={{
                  "data-reorder-position": position,
                  "data-reorder-key": item.id,
                  "data-reorder-placeholder": placeholder || undefined,
                  onPointerDown: canReorder ? rowDrag.pointerDown(index) : () => undefined,
                }}
                onGripKeyDown={rowDrag.keyDown(index)}
              />
            );
          })}
          {children}
        </div>
      )}

      {/* The lifted copy follows the pointer above everything, so it is portaled to the body. */}
      {draggedTile &&
        galleryDrag.grab &&
        createPortal(
          <div
            ref={galleryDrag.ghostRef}
            className={cn(GHOST_CLASS, "bg-mu-well")}
            style={{
              width: galleryDrag.grab.width,
              height: galleryDrag.grab.height,
              translate: `${galleryDrag.grab.left}px ${galleryDrag.grab.top}px`,
              background: draggedTile.category === "image" && isDrawingFilename(draggedTile.filename) ? DRAWING_PAPER : undefined,
            }}
          >
            <TileMedia item={draggedTile} />
          </div>,
          document.body,
        )}
      {draggedRow &&
        rowDrag.grab &&
        createPortal(
          <div
            ref={rowDrag.ghostRef}
            className={cn(GHOST_CLASS, "flex items-center gap-1 bg-mu-surface px-2 mu-caption text-mu-ink")}
            style={{ width: rowDrag.grab.width, height: rowDrag.grab.height, translate: `${rowDrag.grab.left}px ${rowDrag.grab.top}px` }}
          >
            <span className={METADATA_ROW_SLOT_CLASSES}>
              {draggedRow.category === "audio" ? (
                <FileAudioIcon className="mu-icon-sm text-mu-ink-muted" />
              ) : (
                <FileIcon className="mu-icon-sm text-mu-ink-muted" />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate">{draggedRow.filename}</span>
          </div>,
          document.body,
        )}

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
