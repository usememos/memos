import { DownloadIcon, FileIcon, PaperclipIcon, PlayIcon } from "lucide-react";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import MetadataSection from "@/components/MemoMetadata/MetadataSection";
import MotionPhotoPreview from "@/components/MotionPhotoPreview";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";
import type { AttachmentVisualItem, PreviewMediaItem } from "@/utils/media-item";
import { buildAttachmentVisualItems } from "@/utils/media-item";
import AudioAttachmentItem from "./AudioAttachmentItem";
import { getAttachmentMetadata, isAudioAttachment, separateAttachments } from "./attachmentHelpers";

interface AttachmentListViewProps {
  attachments: Attachment[];
  onImagePreview?: (items: PreviewMediaItem[], index: number) => void;
}

type VisualItem = AttachmentVisualItem;

const VISUAL_TILE_CLASS =
  "group relative overflow-hidden rounded-xl border border-border/70 bg-muted/30 text-left transition-colors hover:border-accent/40";
const COVER_MEDIA_CLASS = "h-full w-full rounded-none object-cover transition-transform duration-300 group-hover:scale-[1.02]";
const NATURAL_MEDIA_CLASS =
  "block h-auto max-h-[20rem] w-auto max-w-full rounded-none transition-transform duration-300 group-hover:scale-[1.02]";
const SINGLE_VIDEO_CARD_WIDTH_CLASS = "w-full max-w-[30rem]";
const TWO_ITEM_GRID_HEIGHT_CLASS = "h-[11rem] sm:h-[13rem] md:h-[15rem]";
const MOSAIC_GRID_HEIGHT_CLASS = "h-[13rem] sm:h-[16rem] md:h-[18rem]";

const AttachmentMeta = ({ attachment }: { attachment: Attachment }) => {
  const { fileTypeLabel, fileSizeLabel } = getAttachmentMetadata(attachment);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
      <span>{fileTypeLabel}</span>
      {fileSizeLabel && (
        <>
          <span className="text-muted-foreground/40">•</span>
          <span>{fileSizeLabel}</span>
        </>
      )}
    </div>
  );
};

const DocumentItem = ({ attachment }: { attachment: Attachment }) => {
  return (
    <div className="group flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/65 px-3 py-2.5 transition-colors hover:bg-accent/20">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
          <FileIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium leading-tight text-foreground" title={attachment.filename}>
            {attachment.filename}
          </div>
          <AttachmentMeta attachment={attachment} />
        </div>
      </div>
      <DownloadIcon className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground/70" />
    </div>
  );
};

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
    <button type="button" className={cn(VISUAL_TILE_CLASS, className)} onClick={onPreview}>
      {children}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/15 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      {overlayLabel && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 text-2xl font-semibold text-white backdrop-blur-[2px]">
          {overlayLabel}
        </div>
      )}
    </button>
  );
};

const VideoPlayBadge = ({ className, children }: PropsWithChildren<{ className?: string }>) => (
  <span
    className={cn(
      "pointer-events-none absolute inline-flex items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur-sm",
      className,
    )}
  >
    {children}
  </span>
);

const CollageVisualItem = ({
  item,
  onPreview,
  className,
  overlayLabel,
}: {
  item: VisualItem;
  onPreview?: () => void;
  className?: string;
  overlayLabel?: string;
}) => {
  const motionPreviewProps = item.kind === "motion" ? getMotionPreviewProps(item) : undefined;

  return (
    <VisualTile className={cn("block h-full w-full", className)} onPreview={onPreview} overlayLabel={overlayLabel}>
      {item.kind === "video" ? (
        <>
          <video src={item.sourceUrl} className={COVER_MEDIA_CLASS} preload="metadata" />
          {!overlayLabel && (
            <VideoPlayBadge className="bottom-2 right-2 h-7 w-7 bg-background/80 text-foreground/70">
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
          badgeClassName="left-2 top-2 px-2 py-0.5 text-[10px]"
          mediaClassName={COVER_MEDIA_CLASS}
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
          videoClassName="absolute inset-0 h-full w-full rounded-none object-contain transition-transform duration-300 group-hover:scale-[1.02]"
          badgeClassName="left-2 top-2 px-2 py-0.5 text-[10px]"
        />
      </VisualTile>
    );
  }

  return (
    <VisualTile className={cn("block", SINGLE_VIDEO_CARD_WIDTH_CLASS)} onPreview={onPreview}>
      <div className="relative aspect-video bg-black/5">
        <video src={item.sourceUrl} poster={item.posterUrl} className={COVER_MEDIA_CLASS} preload="metadata" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
        <VideoPlayBadge className="bottom-3 right-3 h-9 w-9">
          <PlayIcon className="h-4 w-4 fill-current" />
        </VideoPlayBadge>
      </div>
    </VisualTile>
  );
};

const VisualGallery = ({ items, onPreview }: { items: VisualItem[]; onPreview?: (itemId: string) => void }) => {
  if (items.length === 0) {
    return null;
  }

  if (items.length === 1) {
    return (
      <div className="w-full">
        <SingleVisualItem item={items[0]} onPreview={() => onPreview?.(items[0].id)} />
      </div>
    );
  }

  if (items.length === 2) {
    return (
      <div className={cn("grid grid-cols-2 gap-2", TWO_ITEM_GRID_HEIGHT_CLASS)}>
        {items.map((item) => (
          <CollageVisualItem key={item.id} item={item} onPreview={() => onPreview?.(item.id)} />
        ))}
      </div>
    );
  }

  if (items.length === 3) {
    return (
      <div className={cn("grid grid-cols-2 grid-rows-2 gap-2", MOSAIC_GRID_HEIGHT_CLASS)}>
        <CollageVisualItem item={items[0]} className="row-span-2" onPreview={() => onPreview?.(items[0].id)} />
        <CollageVisualItem item={items[1]} onPreview={() => onPreview?.(items[1].id)} />
        <CollageVisualItem item={items[2]} onPreview={() => onPreview?.(items[2].id)} />
      </div>
    );
  }

  const visibleItems = items.slice(0, 4);
  const remainingCount = items.length - visibleItems.length;

  return (
    <div className={cn("grid grid-cols-2 grid-rows-2 gap-2", MOSAIC_GRID_HEIGHT_CLASS)}>
      {visibleItems.map((item, index) => (
        <CollageVisualItem
          key={item.id}
          item={item}
          overlayLabel={index === visibleItems.length - 1 && remainingCount > 0 ? `+${remainingCount}` : undefined}
          onPreview={() => onPreview?.(item.id)}
        />
      ))}
    </div>
  );
};

const AudioList = ({ attachments, compact = false }: { attachments: Attachment[]; compact?: boolean }) => (
  <div className={cn("gap-2", compact ? "grid grid-cols-1 sm:grid-cols-2" : "flex flex-col")}>
    {attachments.map((attachment) => (
      <AudioAttachmentItem
        key={attachment.name}
        filename={attachment.filename}
        sourceUrl={getAttachmentUrl(attachment)}
        mimeType={attachment.type}
        size={Number(attachment.size)}
        compact={compact}
      />
    ))}
  </div>
);

const DocsList = ({ attachments }: { attachments: Attachment[] }) => (
  <div className="flex flex-col gap-2">
    {attachments.map((attachment) => (
      <a key={attachment.name} href={getAttachmentUrl(attachment)} download title={`Download ${attachment.filename}`}>
        <DocumentItem attachment={attachment} />
      </a>
    ))}
  </div>
);

const Divider = () => <div className="border-t border-border/70 opacity-80" />;

const AttachmentListView = ({ attachments, onImagePreview }: AttachmentListViewProps) => {
  const { visual, audio, docs } = useMemo(() => separateAttachments(attachments), [attachments]);
  const visualItems = useMemo(() => buildAttachmentVisualItems(visual), [visual]);
  const previewItems = useMemo(() => visualItems.map((item) => item.previewItem), [visualItems]);
  const hasVisual = visualItems.length > 0;
  const hasAudio = audio.length > 0;
  const hasDocs = docs.length > 0;
  const hasMedia = hasVisual || hasAudio;

  if (attachments.length === 0) {
    return null;
  }

  const handlePreview = (itemId: string) => {
    const index = previewItems.findIndex((item) => item.id === itemId);
    onImagePreview?.(previewItems, index >= 0 ? index : 0);
  };

  return (
    <MetadataSection
      icon={PaperclipIcon}
      title="Attachments"
      count={visualItems.length + audio.length + docs.length}
      contentClassName="flex flex-col gap-2 p-2"
    >
      {hasMedia && (
        <div className="flex flex-col gap-2">
          {hasVisual && <VisualGallery items={visualItems} onPreview={handlePreview} />}
          {hasAudio && <AudioList attachments={audio.filter(isAudioAttachment)} compact />}
        </div>
      )}
      {hasMedia && hasDocs && <Divider />}
      {hasDocs && <DocsList attachments={docs} />}
    </MetadataSection>
  );
};

export default AttachmentListView;
