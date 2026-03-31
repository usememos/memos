import { FileIcon, PaperclipIcon } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";
import SectionHeader from "../SectionHeader";
import AttachmentCard from "./AttachmentCard";
import AudioAttachmentItem from "./AudioAttachmentItem";
import { getAttachmentMetadata, isImageAttachment, separateAttachments } from "./attachmentViewHelpers";

interface AttachmentListViewProps {
  attachments: Attachment[];
  onImagePreview?: (urls: string[], index: number) => void;
}

const DocumentItem = ({ attachment }: { attachment: Attachment }) => {
  const { fileTypeLabel, fileSizeLabel } = getAttachmentMetadata(attachment);

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

interface VisualItemProps {
  attachment: Attachment;
  onImageClick?: (url: string) => void;
}

const VisualItem = ({ attachment, onImageClick }: VisualItemProps) => {
  const isInteractive = isImageAttachment(attachment) && Boolean(onImageClick);

  const handleClick = () => {
    if (isInteractive) {
      onImageClick?.(getAttachmentUrl(attachment));
    }
  };

  return (
    <div
      className={cn(
        "aspect-square rounded-lg overflow-hidden bg-muted/40 border border-border hover:border-accent/50 transition-all group",
        isInteractive && "cursor-pointer",
      )}
      onClick={handleClick}
    >
      <AttachmentCard attachment={attachment} className="rounded-none" />
    </div>
  );
};

const VisualGrid = ({ attachments, onImageClick }: { attachments: Attachment[]; onImageClick?: (url: string) => void }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
    {attachments.map((attachment) => (
      <VisualItem key={attachment.name} attachment={attachment} onImageClick={onImageClick} />
    ))}
  </div>
);

const AudioList = ({ attachments }: { attachments: Attachment[] }) => (
  <div className="flex flex-col gap-2">
    {attachments.map((attachment) => (
      <AudioAttachmentItem key={attachment.name} attachment={attachment} />
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

const Divider = () => <div className="border-t mt-1 border-border opacity-60" />;

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

      <div className="p-1.5 flex flex-col gap-1">
        {visual.length > 0 && <VisualGrid attachments={visual} onImageClick={handleImageClick} />}

        {visual.length > 0 && sectionCount > 1 && <Divider />}

        {audio.length > 0 && <AudioList attachments={audio} />}

        {audio.length > 0 && docs.length > 0 && <Divider />}

        {docs.length > 0 && <DocsList attachments={docs} />}
      </div>
    </div>
  );
};

export default AttachmentListView;
