import { DownloadIcon, FileIcon, PaperclipIcon, PlayIcon } from "lucide-react";
import { useMemo } from "react";
import MetadataSection from "@/components/MemoMetadata/MetadataSection";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";
import type { PreviewMediaItem } from "@/utils/media-item";
import { buildAttachmentVisualItems } from "@/utils/media-item";
import AudioAttachmentItem from "./AudioAttachmentItem";
import { getAttachmentMetadata, isAudioAttachment, separateAttachments } from "./attachmentHelpers";

interface AttachmentListViewProps {
  attachments: Attachment[];
  onImagePreview?: (items: PreviewMediaItem[], index: number) => void;
}

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

const MotionBadge = () => (
  <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white backdrop-blur-sm">
    LIVE
  </span>
);

const MotionItem = ({
  item,
  featured = false,
  onPreview,
}: {
  item: ReturnType<typeof buildAttachmentVisualItems>[number];
  featured?: boolean;
  onPreview?: () => void;
}) => {
  return (
    <button
      type="button"
      className={cn("group block w-full text-left", featured ? "max-w-[18rem] sm:max-w-[20rem]" : "")}
      onClick={onPreview}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-border/70 bg-muted/30 transition-colors hover:border-accent/40",
          featured ? "aspect-[4/3]" : "aspect-square",
        )}
      >
        {item.kind === "video" ? (
          <video
            src={item.sourceUrl}
            className="h-full w-full rounded-none object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            preload="metadata"
          />
        ) : (
          <img
            src={item.posterUrl}
            alt={item.filename}
            className="h-full w-full rounded-none object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            decoding="async"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        {item.kind === "motion" && <MotionBadge />}
        {item.previewItem.kind === "video" && (
          <span className="pointer-events-none absolute bottom-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground/70 backdrop-blur-sm">
            <PlayIcon className="h-3.5 w-3.5 fill-current" />
          </span>
        )}
      </div>
    </button>
  );
};

const VisualGallery = ({
  items,
  onPreview,
}: {
  items: ReturnType<typeof buildAttachmentVisualItems>;
  onPreview?: (itemId: string) => void;
}) => {
  if (items.length === 1) {
    return (
      <div className="flex">
        <MotionItem item={items[0]} featured onPreview={() => onPreview?.(items[0].id)} />
      </div>
    );
  }

  return (
    <div className="grid max-w-[22rem] grid-cols-2 gap-1.5 sm:max-w-[24rem]">
      {items.map((item) => (
        <MotionItem key={item.id} item={item} onPreview={() => onPreview?.(item.id)} />
      ))}
    </div>
  );
};

const AudioList = ({ attachments }: { attachments: Attachment[] }) => (
  <div className="flex flex-col gap-2">
    {attachments.map((attachment) => (
      <AudioAttachmentItem
        key={attachment.name}
        filename={attachment.filename}
        sourceUrl={getAttachmentUrl(attachment)}
        mimeType={attachment.type}
        size={Number(attachment.size)}
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
  const sectionCount = [hasVisual, hasAudio, hasDocs].filter(Boolean).length;

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
      {hasVisual && <VisualGallery items={visualItems} onPreview={handlePreview} />}
      {hasVisual && sectionCount > 1 && <Divider />}
      {hasAudio && <AudioList attachments={audio.filter(isAudioAttachment)} />}
      {hasAudio && hasDocs && <Divider />}
      {hasDocs && <DocsList attachments={docs} />}
    </MetadataSection>
  );
};

export default AttachmentListView;
