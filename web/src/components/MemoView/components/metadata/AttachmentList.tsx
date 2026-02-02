import { FileIcon, PaperclipIcon } from "lucide-react";
import { useState } from "react";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";
import PreviewImageDialog from "../../../PreviewImageDialog";
import AttachmentCard from "./AttachmentCard";
import SectionHeader from "./SectionHeader";

interface AttachmentListProps {
  attachments: Attachment[];
}

const separateMediaAndDocs = (attachments: Attachment[]): { media: Attachment[]; docs: Attachment[] } => {
  const media: Attachment[] = [];
  const docs: Attachment[] = [];

  for (const attachment of attachments) {
    const attachmentType = getAttachmentType(attachment);
    if (attachmentType === "image/*" || attachmentType === "video/*") {
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
    <div className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-accent/20 transition-colors whitespace-nowrap">
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

const MediaGrid = ({ attachments, onImageClick }: { attachments: Attachment[]; onImageClick: (url: string) => void }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
    {attachments.map((attachment) => (
      <div
        key={attachment.name}
        className="aspect-square rounded-lg overflow-hidden bg-muted/40 border border-border hover:border-accent/50 transition-all cursor-pointer group"
        onClick={() => onImageClick(getAttachmentUrl(attachment))}
      >
        <div className="w-full h-full relative">
          <AttachmentCard attachment={attachment} className="rounded-none" />
          {getAttachmentType(attachment) === "video/*" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
              <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center">
                <svg className="w-5 h-5 text-black fill-current ml-0.5" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>
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

  const { media: mediaItems, docs: docItems } = separateMediaAndDocs(attachments);

  if (attachments.length === 0) {
    return null;
  }

  const handleImageClick = (imgUrl: string) => {
    const imageAttachments = mediaItems.filter((a) => getAttachmentType(a) === "image/*");
    const imgUrls = imageAttachments.map((a) => getAttachmentUrl(a));
    const index = imgUrls.findIndex((url) => url === imgUrl);
    const mimeType = imageAttachments[index]?.type;
    setPreviewImage({ open: true, urls: imgUrls, index, mimeType });
  };

  return (
    <>
      <div className="w-full rounded-lg border border-border bg-muted/20 overflow-hidden">
        <SectionHeader icon={PaperclipIcon} title="Attachments" count={attachments.length} />

        <div className="p-2 flex flex-col gap-1">
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
