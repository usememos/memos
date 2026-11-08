import { buttonClasses } from "@usememos/ui";
import { DownloadIcon, ExternalLinkIcon, FileIcon, PlayIcon } from "lucide-react";
import type { KeyboardEvent, PropsWithChildren } from "react";
import { Suspense, useMemo, useState } from "react";
import { DRAWING_PAPER, DrawingViewer, isDrawingFilename } from "@/components/DrawingSheet";
import MotionPhotoPreview from "@/components/MotionPhotoPreview";
import VideoPoster from "@/components/VideoPoster";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import { getAttachmentUrl, isImage } from "@/utils/attachment";
import { useTranslate } from "@/utils/i18n";
import type { AttachmentVisualItem, PreviewMediaItem } from "@/utils/media-item";
import { buildAttachmentVisualItems } from "@/utils/media-item";
import {
  METADATA_ROW_BOX_CLASSES,
  METADATA_ROW_CLASSES,
  METADATA_ROW_CONTENT_TEXT_CLASSES,
  METADATA_ROW_CONTROLS_CLASSES,
  METADATA_ROW_HINT_CLASSES,
  METADATA_ROW_LABEL_CLASSES,
  MetadataRowDetail,
  MetadataRowIconSlot,
} from "../MetadataSection";
import AudioAttachmentItem from "./AudioAttachmentItem";
import { getAttachmentMetadata } from "./attachmentHelpers";
import {
  COLLAGE_VIDEO_PLAY_BADGE_CLASS,
  COVER_MEDIA_CLASS,
  DRAWING_SHEET_CELL_MEDIA_CLASS,
  DRAWING_SHEET_MEDIA_CLASS,
  DRAWING_SHEET_SINGLE_CLASS,
  DRAWING_SHEET_TILE_CLASS,
  MEDIA_HOVER_GRADIENT_CLASS,
  MEDIA_HOVER_SURFACE_CLASS,
  NATURAL_MEDIA_CLASS,
  OVERFLOW_TILE_OVERLAY_CLASS,
  SINGLE_MOTION_VIDEO_CLASS,
  SINGLE_VIDEO_CARD_WIDTH_CLASS,
  VISUAL_TILE_BUTTON_CLASS,
} from "./attachmentVisualClasses";
import { resolveVisualGalleryLayout } from "./visualGalleryLayout";

type VisualItem = AttachmentVisualItem;

const getMotionPreviewProps = (item: VisualItem) => ({
  motionUrl: item.previewItem.kind === "motion" ? item.previewItem.motionUrl : item.sourceUrl,
  presentationTimestampUs: item.previewItem.kind === "motion" ? item.previewItem.presentationTimestampUs : undefined,
});

/** A drawing (a `.canvas.png` image) shows as a sheet of paper instead of a framed photo. */
const isDrawing = (item: VisualItem) => item.kind === "image" && isDrawingFilename(item.filename);

/**
 * A tile is a div, not a <button>: it holds block media. When it opens the viewer it takes the
 * button role and keys, so keyboard users reach it too; its name comes from the media's alt text.
 */
const tileInteraction = (onPreview?: () => void) =>
  onPreview
    ? {
        role: "button",
        tabIndex: 0,
        onClick: onPreview,
        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
          // Only the tile's own keys: a motion photo's Live badge inside it is a control too.
          if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          onPreview();
        },
      }
    : undefined;

const VisualTile = ({
  className,
  onPreview,
  overlayLabel,
  children,
}: PropsWithChildren<{ className?: string; onPreview?: () => void; overlayLabel?: string }>) => (
  <div className={cn(VISUAL_TILE_BUTTON_CLASS, className)} {...tileInteraction(onPreview)}>
    <div className={MEDIA_HOVER_SURFACE_CLASS}>
      {children}
      <div className={MEDIA_HOVER_GRADIENT_CLASS} aria-hidden />
    </div>
    {overlayLabel && <div className={OVERFLOW_TILE_OVERLAY_CLASS}>{overlayLabel}</div>}
  </div>
);

/**
 * The paper a drawing was made on. An export is opaque with the paper filling it, so its corner
 * pixel is paper; a drawing made before the paper was fixed keeps its own. Undefined when the
 * image can't be read.
 */
const readPaperColor = (img: HTMLImageElement): string | undefined => {
  try {
    const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!context) return undefined;
    context.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return `rgb(${r} ${g} ${b})`;
  } catch {
    return undefined;
  }
};

/**
 * A drawing as a sheet of paper. The sheet extends the drawing's own paper beyond its edges, so
 * it can be any size. The image is the original file at 2x: exports carry 2 pixels per drawn
 * pixel, so it shows at the size it was drawn and keeps strokes and text sharp.
 */
const DrawingTile = ({
  item,
  className,
  mediaClassName,
  onPreview,
  overlayLabel,
}: {
  item: VisualItem;
  className: string;
  mediaClassName: string;
  onPreview?: () => void;
  overlayLabel?: string;
}) => {
  const [paper, setPaper] = useState(DRAWING_PAPER);
  return (
    <div className={cn(DRAWING_SHEET_TILE_CLASS, className)} style={{ background: paper }} {...tileInteraction(onPreview)}>
      <img
        src={item.sourceUrl}
        srcSet={`${item.sourceUrl} 2x`}
        alt={item.filename}
        className={mediaClassName}
        loading="lazy"
        decoding="async"
        onLoad={(event) => setPaper(readPaperColor(event.currentTarget) ?? DRAWING_PAPER)}
      />
      {overlayLabel && <div className={OVERFLOW_TILE_OVERLAY_CLASS}>{overlayLabel}</div>}
    </div>
  );
};

const VideoPlayBadge = ({ className, children }: PropsWithChildren<{ className?: string }>) => (
  <div
    className={cn(
      "pointer-events-none absolute flex items-center justify-center rounded-full bg-mu-canvas/80 text-mu-ink/70 backdrop-blur-sm",
      className,
    )}
  >
    {children}
  </div>
);

const CollageVisualItem = ({
  item,
  className,
  overlayLabel,
  onPreview,
}: {
  item: VisualItem;
  className?: string;
  overlayLabel?: string;
  onPreview?: () => void;
}) => {
  const motionPreviewProps = item.kind === "motion" ? getMotionPreviewProps(item) : undefined;
  if (isDrawing(item)) {
    return (
      <DrawingTile
        item={item}
        className={cn("block h-full w-full", className)}
        mediaClassName={DRAWING_SHEET_CELL_MEDIA_CLASS}
        onPreview={onPreview}
        overlayLabel={overlayLabel}
      />
    );
  }
  return (
    <VisualTile className={cn("block h-full w-full", className)} onPreview={onPreview} overlayLabel={overlayLabel}>
      {item.kind === "video" ? (
        <>
          <VideoPoster sourceUrl={item.sourceUrl} posterUrl={item.posterUrl} alt={item.filename} className={COVER_MEDIA_CLASS} />
          {!overlayLabel && (
            <VideoPlayBadge className={COLLAGE_VIDEO_PLAY_BADGE_CLASS}>
              <PlayIcon className="mu-icon-sm fill-current" />
            </VideoPlayBadge>
          )}
        </>
      ) : item.kind === "motion" && motionPreviewProps ? (
        <MotionPhotoPreview
          posterUrl={item.posterUrl}
          motionUrl={motionPreviewProps.motionUrl}
          alt={item.filename}
          presentationTimestampUs={motionPreviewProps.presentationTimestampUs}
          containerClassName="h-full w-full"
          posterClassName={COVER_MEDIA_CLASS}
          videoClassName={COVER_MEDIA_CLASS}
        />
      ) : (
        <img src={item.posterUrl} alt={item.filename} className={COVER_MEDIA_CLASS} loading="lazy" decoding="async" />
      )}
    </VisualTile>
  );
};

const SingleVisualItem = ({ item, onPreview }: { item: VisualItem; onPreview?: () => void }) => {
  const motionPreviewProps = item.kind === "motion" ? getMotionPreviewProps(item) : undefined;

  if (isDrawing(item)) {
    return (
      <DrawingTile item={item} className={DRAWING_SHEET_SINGLE_CLASS} mediaClassName={DRAWING_SHEET_MEDIA_CLASS} onPreview={onPreview} />
    );
  }

  if (item.kind === "image") {
    return (
      <VisualTile className="inline-block max-w-full" onPreview={onPreview}>
        <img src={item.posterUrl} alt={item.filename} className={NATURAL_MEDIA_CLASS} loading="lazy" decoding="async" />
      </VisualTile>
    );
  }

  if (item.kind === "motion" && motionPreviewProps) {
    return (
      <VisualTile className="inline-block max-w-full" onPreview={onPreview}>
        <MotionPhotoPreview
          posterUrl={item.posterUrl}
          motionUrl={motionPreviewProps.motionUrl}
          alt={item.filename}
          presentationTimestampUs={motionPreviewProps.presentationTimestampUs}
          containerClassName="max-w-full"
          posterClassName={cn(NATURAL_MEDIA_CLASS, "object-contain")}
          videoClassName={SINGLE_MOTION_VIDEO_CLASS}
          badgeClassName="left-2 top-2 px-2 py-0.5 mu-caption"
        />
      </VisualTile>
    );
  }

  return (
    <VisualTile className={cn("block", SINGLE_VIDEO_CARD_WIDTH_CLASS)} onPreview={onPreview}>
      <div className="relative aspect-video bg-black/5">
        <VideoPoster sourceUrl={item.sourceUrl} posterUrl={item.posterUrl} alt={item.filename} className={COVER_MEDIA_CLASS} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
        <VideoPlayBadge className="bottom-3 right-3 h-9 w-9">
          <PlayIcon className="mu-icon fill-current" />
        </VideoPlayBadge>
      </div>
    </VisualTile>
  );
};

interface AttachmentGalleryProps {
  visual: Attachment[];
  onImagePreview?: (items: PreviewMediaItem[], index: number) => void;
  /** Opens drawings in the drawing viewer instead of the image viewer, with Edit when `canEdit`. */
  drawings?: { memo: Pick<Memo, "name" | "attachments">; canEdit: boolean };
}

/** The memo's images, motion photos and videos as the bare gallery, flush with the content. */
export const AttachmentGallery = ({ visual, onImagePreview, drawings }: AttachmentGalleryProps) => {
  const visualItems = useMemo(() => buildAttachmentVisualItems(visual), [visual]);
  const layout = resolveVisualGalleryLayout(visualItems);
  const [openDrawing, setOpenDrawing] = useState<VisualItem>();

  if (!layout) {
    return null;
  }

  const handlePreview = (itemId: string) => {
    const previewItems = visualItems.map((item) => item.previewItem);
    const index = previewItems.findIndex((item) => item.id === itemId);
    onImagePreview?.(previewItems, index >= 0 ? index : 0);
  };

  // A drawing opens as a drawing: in the read-only canvas, not the image viewer.
  const openItem = (item: VisualItem) => {
    if (drawings && isDrawing(item) && item.attachments[0]) setOpenDrawing(item);
    else handlePreview(item.id);
  };

  const drawingViewer = drawings && openDrawing?.attachments[0] && (
    <Suspense fallback={null}>
      <DrawingViewer
        attachment={openDrawing.attachments[0]}
        memo={drawings.memo}
        canEdit={drawings.canEdit}
        onClose={() => setOpenDrawing(undefined)}
        onNoScene={() => {
          setOpenDrawing(undefined);
          handlePreview(openDrawing.id);
        }}
      />
    </Suspense>
  );

  if (layout.mode === "single") {
    return (
      <div className="w-full">
        <SingleVisualItem item={layout.item} onPreview={() => openItem(layout.item)} />
        {drawingViewer}
      </div>
    );
  }

  return (
    <div className={cn("w-full", layout.containerClassName)}>
      {layout.cells.map(({ item, className, overlayLabel }) => (
        <CollageVisualItem key={item.id} item={item} className={className} overlayLabel={overlayLabel} onPreview={() => openItem(item)} />
      ))}
      {drawingViewer}
    </div>
  );
};

/** The file server renders only images and PDFs inline; it serves every other file as a download. */
const opensInline = (mimeType: string) => mimeType === "application/pdf" || isImage(mimeType);

/** Share links carry an external link too, but it still points at this instance's file server. A link that does not parse is not ours. */
const isServedHere = (url: string) => {
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
};

/**
 * A document is a row: file glyph in the slot, name, type and size on the detail rail.
 * A file the browser can show, or a link to another site, opens in a new tab; any other
 * file downloads. A shown file offers its download in the trailing overlay. Hint and
 * controls only appear over the detail rail once the row is engaged, so the rail stays on
 * the same edge as every other row's at rest.
 */
const DocumentRow = ({ attachment }: { attachment: Attachment }) => {
  const t = useTranslate();
  const { fileTypeLabel, fileSizeLabel } = getAttachmentMetadata(attachment);
  const url = getAttachmentUrl(attachment);
  const body = (
    <>
      <MetadataRowIconSlot icon={FileIcon} />
      <span className={METADATA_ROW_CONTENT_TEXT_CLASSES}>{attachment.filename}</span>
      <MetadataRowDetail parts={[fileTypeLabel, fileSizeLabel]} />
    </>
  );

  if (!isServedHere(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={t("common.open-name", { name: attachment.filename })}
        className={METADATA_ROW_CLASSES}
      >
        {body}
        <ExternalLinkIcon aria-hidden="true" className={METADATA_ROW_HINT_CLASSES} />
      </a>
    );
  }

  if (!opensInline(attachment.type)) {
    return (
      <a href={url} download title={t("common.download-name", { name: attachment.filename })} className={METADATA_ROW_CLASSES}>
        {body}
        <DownloadIcon aria-hidden="true" className={METADATA_ROW_HINT_CLASSES} />
      </a>
    );
  }

  return (
    <div className={METADATA_ROW_BOX_CLASSES}>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={t("common.open-name", { name: attachment.filename })}
        className={METADATA_ROW_LABEL_CLASSES}
      >
        {body}
      </a>
      <div className={METADATA_ROW_CONTROLS_CLASSES}>
        <a
          href={url}
          download
          title={t("common.download")}
          aria-label={t("common.download-name", { name: attachment.filename })}
          className={buttonClasses({ variant: "ghost", size: "xs", iconOnly: true })}
        >
          <DownloadIcon className="mu-icon-sm" />
        </a>
      </div>
    </div>
  );
};

/** Audio and file attachments as metadata rows, for a host that owns the row list. */
export const AttachmentRows = ({ audio, docs }: { audio: Attachment[]; docs: Attachment[] }) => (
  <>
    {audio.map((attachment) => (
      <AudioAttachmentItem
        key={attachment.name}
        filename={attachment.filename}
        sourceUrl={getAttachmentUrl(attachment)}
        mimeType={attachment.type}
        size={Number(attachment.size)}
      />
    ))}
    {docs.map((attachment) => (
      <DocumentRow key={attachment.name} attachment={attachment} />
    ))}
  </>
);
