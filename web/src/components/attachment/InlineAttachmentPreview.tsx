import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";
import { AttachmentPreviewContent } from "./AttachmentPreviewContent";

interface InlineAttachmentPreviewProps {
  attachment: Attachment;
  attachments: Attachment[];
  onClose: () => void;
  onNavigate: (attachment: Attachment) => void;
}

export function InlineAttachmentPreview({ attachment, attachments, onClose, onNavigate }: InlineAttachmentPreviewProps) {
  const currentIndex = attachments.findIndex((a) => a.name === attachment.name);
  const hasNext = currentIndex < attachments.length - 1;
  const hasPrevious = currentIndex > 0;

  const handlePrevious = () => {
    if (hasPrevious) {
      onNavigate(attachments[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      onNavigate(attachments[currentIndex + 1]);
    }
  };

  const downloadUrl = getAttachmentUrl(attachment);

  return (
    <div className="w-full mt-3 rounded-lg border border-border bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {attachments.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevious}
                disabled={!hasPrevious}
                className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground min-w-[40px] text-center">
                {currentIndex + 1} / {attachments.length}
              </span>
              <button
                onClick={handleNext}
                disabled={!hasNext}
                className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          <span className="text-sm font-medium truncate">{attachment.filename}</span>
        </div>

        <div className="flex items-center gap-1">
          <a
            href={downloadUrl}
            download={attachment.filename}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview content */}
      <div className="h-[400px] md:h-[500px]">
        <AttachmentPreviewContent attachment={attachment} />
      </div>
    </div>
  );
}
