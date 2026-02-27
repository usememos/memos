import { FileIcon, PaperclipIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";
import PreviewImageDialog from "../../../PreviewImageDialog";
import AttachmentCard from "./AttachmentCard";
import SectionHeader from "./SectionHeader";

interface AttachmentListProps {
  attachments: Attachment[];
}

// Type guards for attachment types
const isImageAttachment = (attachment: Attachment): boolean => getAttachmentType(attachment) === "image/*";
const isVideoAttachment = (attachment: Attachment): boolean => getAttachmentType(attachment) === "video/*";
const isMediaAttachment = (attachment: Attachment): boolean => isImageAttachment(attachment) || isVideoAttachment(attachment);

// Separate attachments into media (images/videos) and documents
const separateMediaAndDocs = (attachments: Attachment[]): { media: Attachment[]; docs: Attachment[] } => {
  const media: Attachment[] = [];
  const docs: Attachment[] = [];

  for (const attachment of attachments) {
    if (isMediaAttachment(attachment)) {
      media.push(attachment);
    } else {
      docs.push(attachment);
    }
  }

  return { media, docs };
};

const DocumentItem = ({ attachment }: { attachment: Attachment }) => {
  const fileTypeLabel = getFileTypeLabel(attachment.type);
  const fileSizeLabel = attachment.size ? formatFileSize(Number(attachment.size)) : undefined;

  return (
    <div className="flex items-center gap-1 px-1 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors whitespace-nowrap">
      <div className="shrink-0 w-5 h-5 rounded overflow-hidden bg-muted/40 flex items-center justify-center">
        <FileIcon className="w-3 h-3 text-muted-foreground" />
      </div>
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-xs truncate" title={attachment.filename}>
          {attachment.filename}
        </span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <span className="text-muted-foreground/50">•</span>
          <span>{fileTypeLabel}</span>
          {fileSizeLabel && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span>{fileSizeLabel}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface MediaItemProps {
  attachment: Attachment;
  onImageClick: (url: string) => void;
}

const MediaItem = ({ attachment, onImageClick }: MediaItemProps) => {
  const isImage = isImageAttachment(attachment);

  const handleClick = () => {
    if (isImage) {
      onImageClick(getAttachmentUrl(attachment));
    }
  };

  return (
    <div
      className="aspect-square rounded-lg overflow-hidden bg-muted/40 border border-border hover:border-accent/50 transition-all cursor-pointer group"
      onClick={handleClick}
    >
      <AttachmentCard attachment={attachment} className="rounded-none" />
    </div>
  );
};

interface MediaGridProps {
  attachments: Attachment[];
  onImageClick: (url: string) => void;
}

const MediaGrid = ({ attachments, onImageClick }: MediaGridProps) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
    {attachments.map((attachment) => (
      <MediaItem key={attachment.name} attachment={attachment} onImageClick={onImageClick} />
    ))}
  </div>
);

const DocsList = ({ attachments }: { attachments: Attachment[] }) => (
  <div className="flex flex-col gap-0.5">
    {attachments.map((attachment) => (
      <a key={attachment.name} href={getAttachmentUrl(attachment)} download title={`Download ${attachment.filename}`}>
        <DocumentItem attachment={attachment} />
      </a>
    ))}
  </div>
);

const AttachmentList = ({ attachments }: AttachmentListProps) => {
  const [previewImage, setPreviewImage] = useState<{ open: boolean; urls: string[]; index: number; mimeType?: string }>({
    open: false,
    urls: [],
    index: 0,
    mimeType: undefined,
  });

  const { media: mediaItems, docs: docItems } = useMemo(() => separateMediaAndDocs(attachments), [attachments]);

  // Pre-compute image URLs for preview dialog to avoid filtering on every click
  const imageAttachments = useMemo(() => mediaItems.filter(isImageAttachment), [mediaItems]);
  const imageUrls = useMemo(() => imageAttachments.map(getAttachmentUrl), [imageAttachments]);

  if (attachments.length === 0) {
    return null;
  }

  const handleImageClick = (imgUrl: string) => {
    const index = imageUrls.findIndex((url) => url === imgUrl);
    const mimeType = imageAttachments[index]?.type;
    setPreviewImage({ open: true, urls: imageUrls, index, mimeType });
  };

  return (
    <>
      <div className="w-full rounded-lg border border-border bg-muted/20 overflow-hidden no-goto">
        <SectionHeader icon={PaperclipIcon} title="Attachments" count={attachments.length} />

        <div className="p-1.5 flex flex-col gap-1">
          {mediaItems.length > 0 && <MediaGrid attachments={mediaItems} onImageClick={handleImageClick} />}

          {mediaItems.length > 0 && docItems.length > 0 && <div className="border-t mt-1 border-border opacity-60" />}

          {docItems.length > 0 && <DocsList attachments={docItems} />}
        </div>
      </div>

      <PreviewImageDialog
        open={previewImage.open}
        onOpenChange={(open: boolean) => setPreviewImage((prev) => ({ ...prev, open }))}
        imgUrls={previewImage.urls}
        initialIndex={previewImage.index}
      />
    </>
  );
};

export default AttachmentList;
