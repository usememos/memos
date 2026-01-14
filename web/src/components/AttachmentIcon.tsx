import {
  BinaryIcon,
  BookIcon,
  FileArchiveIcon,
  FileAudioIcon,
  FileEditIcon,
  FileIcon,
  FileTextIcon,
  FileVideo2Icon,
  SheetIcon,
} from "lucide-react";
import React from "react";
import { useAttachmentPreview } from "@/components/attachment";
import { cn } from "@/lib/utils";
import { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentThumbnailUrl, getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import SquareDiv from "./kit/SquareDiv";

interface Props {
  attachment: Attachment;
  allAttachments?: Attachment[];
  className?: string;
  strokeWidth?: number;
}

const AttachmentIcon = (props: Props) => {
  const { attachment, allAttachments = [] } = props;
  const { openPreview } = useAttachmentPreview();
  const resourceType = getAttachmentType(attachment);
  const attachmentUrl = getAttachmentUrl(attachment);
  const className = cn("w-full h-auto", props.className);
  const strokeWidth = props.strokeWidth;

  const handleClick = () => {
    // Use the new preview modal for all file types
    const attachmentsToUse = allAttachments.length > 0 ? allAttachments : [attachment];
    openPreview(attachment, attachmentsToUse);
  };

  if (resourceType === "image/*") {
    return (
      <div onClick={handleClick} className="cursor-pointer">
        <SquareDiv className={cn(className, "flex items-center justify-center overflow-clip")}>
          <img
            className="min-w-full min-h-full object-cover"
            src={getAttachmentThumbnailUrl(attachment)}
            onError={(e) => {
              // Fallback to original image if thumbnail fails
              const target = e.target as HTMLImageElement;
              if (target.src.includes("?thumbnail=true")) {
                console.warn("Thumbnail failed, falling back to original image:", attachmentUrl);
                target.src = attachmentUrl;
              }
            }}
            decoding="async"
            loading="lazy"
          />
        </SquareDiv>
      </div>
    );
  }

  const getAttachmentIcon = () => {
    switch (resourceType) {
      case "video/*":
        return <FileVideo2Icon strokeWidth={strokeWidth} className="w-full h-auto" />;
      case "audio/*":
        return <FileAudioIcon strokeWidth={strokeWidth} className="w-full h-auto" />;
      case "text/*":
        return <FileTextIcon strokeWidth={strokeWidth} className="w-full h-auto" />;
      case "application/epub+zip":
        return <BookIcon strokeWidth={strokeWidth} className="w-full h-auto" />;
      case "application/pdf":
        return <BookIcon strokeWidth={strokeWidth} className="w-full h-auto" />;
      case "application/msword":
        return <FileEditIcon strokeWidth={strokeWidth} className="w-full h-auto" />;
      case "application/msexcel":
        return <SheetIcon strokeWidth={strokeWidth} className="w-full h-auto" />;
      case "application/zip":
        return <FileArchiveIcon strokeWidth={strokeWidth} className="w-full h-auto" />;
      case "application/x-java-archive":
        return <BinaryIcon strokeWidth={strokeWidth} className="w-full h-auto" />;
      default:
        return <FileIcon strokeWidth={strokeWidth} className="w-full h-auto" />;
    }
  };

  return (
    <div onClick={handleClick} className={cn(className, "max-w-16 opacity-50 cursor-pointer hover:opacity-75 transition-opacity")}>
      {getAttachmentIcon()}
    </div>
  );
};

export default React.memo(AttachmentIcon);
