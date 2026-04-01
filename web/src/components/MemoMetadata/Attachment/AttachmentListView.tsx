import { DownloadIcon, FileIcon, Maximize2Icon, PaperclipIcon, PlayIcon } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";
import SectionHeader from "../SectionHeader";
import AttachmentCard from "./AttachmentCard";
import AudioAttachmentItem from "./AudioAttachmentItem";
import { getAttachmentMetadata, isImageAttachment, isVideoAttachment, separateAttachments } from "./attachmentViewHelpers";

interface AttachmentListViewProps {
  attachments: Attachment[];
  onImagePreview?: (urls: string[], index: number) => void;
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

interface VisualItemProps {
  attachment: Attachment;
  featured?: boolean;
}

const ImageItem = ({ attachment, onImageClick, featured = false }: VisualItemProps & { onImageClick?: (url: string) => void }) => {
  const handleClick = () => {
    onImageClick?.(getAttachmentUrl(attachment));
  };

  return (
    <button
      type="button"
      className={cn("group block w-full text-left", featured ? "max-w-[18rem] sm:max-w-[20rem]" : "")}
      onClick={handleClick}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-border/70 bg-muted/30 transition-colors hover:border-accent/40",
          featured ? "aspect-[4/3]" : "aspect-square",
        )}
      >
        <AttachmentCard
          attachment={attachment}
          className="h-full w-full rounded-none transition-transform duration-300 group-hover:scale-[1.02]"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="pointer-events-none absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground/70 backdrop-blur-sm">
          <Maximize2Icon className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
};

const ImageGallery = ({ attachments, onImageClick }: { attachments: Attachment[]; onImageClick?: (url: string) => void }) => {
  if (attachments.length === 1) {
    return (
      <div className="flex">
        <ImageItem attachment={attachments[0]} featured onImageClick={onImageClick} />
      </div>
    );
  }

  return (
    <div className="grid max-w-[22rem] grid-cols-2 gap-1.5 sm:max-w-[24rem]">
      {attachments.map((attachment) => (
        <ImageItem key={attachment.name} attachment={attachment} onImageClick={onImageClick} />
      ))}
    </div>
  );
};

const VideoItem = ({ attachment }: VisualItemProps) => (
  <div className="w-full max-w-[20rem] overflow-hidden rounded-xl border border-border/70 bg-background/80">
    <div className="relative aspect-video bg-muted/40">
      <AttachmentCard attachment={attachment} className="h-full w-full rounded-none" />
      <span className="pointer-events-none absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground/70 backdrop-blur-sm">
        <PlayIcon className="h-3.5 w-3.5 fill-current" />
      </span>
    </div>
    <div className="border-t border-border/60 px-3 py-2.5">
      <div className="truncate text-sm font-medium leading-tight text-foreground" title={attachment.filename}>
        {attachment.filename}
      </div>
      <AttachmentMeta attachment={attachment} />
    </div>
  </div>
);

const VideoList = ({ attachments }: { attachments: Attachment[] }) => (
  <div className="flex flex-wrap gap-2">
    {attachments.map((attachment) => (
      <VideoItem key={attachment.name} attachment={attachment} />
    ))}
  </div>
);

const VisualSection = ({ attachments, onImageClick }: { attachments: Attachment[]; onImageClick?: (url: string) => void }) => {
  const images = attachments.filter(isImageAttachment);
  const videos = attachments.filter(isVideoAttachment);

  return (
    <div className="flex flex-col gap-2">
      {images.length > 0 && <ImageGallery attachments={images} onImageClick={onImageClick} />}
      {videos.length > 0 && (
        <div className="flex flex-col gap-2">
          {images.length > 0 && <Divider />}
          <VideoList attachments={videos} />
        </div>
      )}
    </div>
  );
};

const AudioList = ({ attachments }: { attachments: Attachment[] }) => (
  <div className="flex flex-col gap-2">
    {attachments.map((attachment) => (
      <AudioAttachmentItem key={attachment.name} attachment={attachment} />
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

  const imageAttachments = useMemo(() => visual.filter(isImageAttachment), [visual]);
  const imageUrls = useMemo(() => imageAttachments.map(getAttachmentUrl), [imageAttachments]);

  if (attachments.length === 0) {
    return null;
  }

  const handleImageClick = (imgUrl: string) => {
    const index = imageUrls.findIndex((url) => url === imgUrl);
    onImagePreview?.(imageUrls, index >= 0 ? index : 0);
  };

  const sections = [visual.length > 0, audio.length > 0, docs.length > 0];
  const sectionCount = sections.filter(Boolean).length;

  return (
    <div className="w-full rounded-lg border border-border bg-muted/20 overflow-hidden">
      <SectionHeader icon={PaperclipIcon} title="Attachments" count={attachments.length} />

      <div className="flex flex-col gap-2 p-2">
        {visual.length > 0 && <VisualSection attachments={visual} onImageClick={handleImageClick} />}

        {visual.length > 0 && sectionCount > 1 && <Divider />}

        {audio.length > 0 && <AudioList attachments={audio} />}

        {audio.length > 0 && docs.length > 0 && <Divider />}

        {docs.length > 0 && <DocsList attachments={docs} />}
      </div>
    </div>
  );
};

export default AttachmentListView;
