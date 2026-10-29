import { DownloadIcon, ExternalLinkIcon, FileIcon, PlayIcon } from "lucide-react";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import MotionPhotoPreview from "@/components/MotionPhotoPreview";
import { buttonVariants } from "@/components/ui/button";
import VideoPoster from "@/components/VideoPoster";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import { getAttachmentUrl, isImage } from "@/utils/attachment";
import type { AttachmentVisualItem, PreviewMediaItem } from "@/utils/media-item";
import { buildAttachmentVisualItems } from "@/utils/media-item";
import {
  METADATA_ROW_BOX_CLASSES,
  METADATA_ROW_CLASSES,
  METADATA_ROW_CONTROLS_CLASSES,
  METADATA_ROW_HINT_CLASSES,
  METADATA_ROW_LABEL_CLASSES,
  METADATA_ROW_TEXT_CLASSES,
  MetadataRowDetail,
  MetadataRowIconSlot,
} from "../MetadataSection";
import AudioAttachmentItem from "./AudioAttachmentItem";
import { getAttachmentMetadata } from "./attachmentHelpers";
import {
  COLLAGE_VIDEO_PLAY_BADGE_CLASS,
  COVER_MEDIA_CLASS,
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

const VisualTile = ({
  className,
  onPreview,
  overlayLabel,
  children,
}: PropsWithChildren<{ className?: string; onPreview?: () => void; overlayLabel?: string }>) => {
  return (
    <div className={cn(VISUAL_TILE_BUTTON_CLASS, className)} onClick={onPreview}>
      <div className={MEDIA_HOVER_SURFACE_CLASS}>
        {children}
        <div className={MEDIA_HOVER_GRADIENT_CLASS} aria-hidden />
      </div>
      {overlayLabel && <div className={OVERFLOW_TILE_OVERLAY_CLASS}>{overlayLabel}</div>}
    </div>
  );
};

const VideoPlayBadge = ({ className, children }: PropsWithChildren<{ className?: string }>) => (
  <div
    className={cn(
      "pointer-events-none absolute flex items-center justify-center rounded-full bg-background/80 text-foreground/70 shadow-sm backdrop-blur-sm",
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
  return (
    <VisualTile className={cn("block h-full w-full", className)} onPreview={onPreview} overlayLabel={overlayLabel}>
      {item.kind === "video" ? (
        <>
          <VideoPoster sourceUrl={item.sourceUrl} posterUrl={item.posterUrl} alt={item.filename} className={COVER_MEDIA_CLASS} />
          {!overlayLabel && (
            <VideoPlayBadge className={COLLAGE_VIDEO_PLAY_BADGE_CLASS}>
              <PlayIcon className="h-3.5 w-3.5 fill-current" />
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
          badgeClassName="left-2 top-2 px-2 py-0.5 text-[10px]"
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
          <PlayIcon className="h-4 w-4 fill-current" />
        </VideoPlayBadge>
      </div>
    </VisualTile>
  );
};

interface AttachmentGalleryProps {
  visual: Attachment[];
  onImagePreview?: (items: PreviewMediaItem[], index: number) => void;
}

/** The memo's images, motion photos and videos as the bare gallery, flush with the content. */
export const AttachmentGallery = ({ visual, onImagePreview }: AttachmentGalleryProps) => {
  const visualItems = useMemo(() => buildAttachmentVisualItems(visual), [visual]);
  const layout = resolveVisualGalleryLayout(visualItems);

  if (!layout) {
    return null;
  }

  const handlePreview = (itemId: string) => {
    const previewItems = visualItems.map((item) => item.previewItem);
    const index = previewItems.findIndex((item) => item.id === itemId);
    onImagePreview?.(previewItems, index >= 0 ? index : 0);
  };

  if (layout.mode === "single") {
    return (
      <div className="w-full">
        <SingleVisualItem item={layout.item} onPreview={() => handlePreview(layout.item.id)} />
      </div>
    );
  }

  return (
    <div className={cn("w-full", layout.containerClassName)}>
      {layout.cells.map(({ item, className, overlayLabel }) => (
        <CollageVisualItem
          key={item.id}
          item={item}
          className={className}
          overlayLabel={overlayLabel}
          onPreview={() => handlePreview(item.id)}
        />
      ))}
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
  const { fileTypeLabel, fileSizeLabel } = getAttachmentMetadata(attachment);
  const url = getAttachmentUrl(attachment);
  const body = (
    <>
      <MetadataRowIconSlot icon={FileIcon} />
      <span className={METADATA_ROW_TEXT_CLASSES}>{attachment.filename}</span>
      <MetadataRowDetail parts={[fileTypeLabel, fileSizeLabel]} />
    </>
  );

  if (!isServedHere(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" title={`Open ${attachment.filename}`} className={METADATA_ROW_CLASSES}>
        {body}
        <ExternalLinkIcon aria-hidden="true" className={METADATA_ROW_HINT_CLASSES} strokeWidth={1.8} />
      </a>
    );
  }

  if (!opensInline(attachment.type)) {
    return (
      <a href={url} download title={`Download ${attachment.filename}`} className={METADATA_ROW_CLASSES}>
        {body}
        <DownloadIcon aria-hidden="true" className={METADATA_ROW_HINT_CLASSES} strokeWidth={1.8} />
      </a>
    );
  }

  return (
    <div className={METADATA_ROW_BOX_CLASSES}>
      <a href={url} target="_blank" rel="noreferrer" title={`Open ${attachment.filename}`} className={METADATA_ROW_LABEL_CLASSES}>
        {body}
      </a>
      <div className={METADATA_ROW_CONTROLS_CLASSES}>
        <a
          href={url}
          download
          title="Download"
          aria-label={`Download ${attachment.filename}`}
          className={buttonVariants({ variant: "quiet", size: "icon-sm" })}
        >
          <DownloadIcon className="size-3.5" strokeWidth={1.8} />
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
