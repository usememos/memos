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
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { getAttachmentThumbnailUrl, getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import PreviewImageDialog from "./PreviewImageDialog";
import SquareDiv from "./kit/SquareDiv";

interface Props {
  attachment: Attachment;
  className?: string;
  strokeWidth?: number;
}

const AttachmentIcon = (props: Props) => {
  const { attachment } = props;
  const [previewImage, setPreviewImage] = useState<{ open: boolean; urls: string[]; index: number }>({
    open: false,
    urls: [],
    index: 0,
  });
  const resourceType = getAttachmentType(attachment);
  const attachmentUrl = getAttachmentUrl(attachment);
  const className = cn("w-full h-auto", props.className);
  const strokeWidth = props.strokeWidth;

  const previewResource = () => {
    window.open(attachmentUrl);
  };

  const handleImageClick = () => {
    setPreviewImage({ open: true, urls: [attachmentUrl], index: 0 });
  };

  if (resourceType === "image/*") {
    return (
      <>
        <SquareDiv className={cn(className, "flex items-center justify-center overflow-clip")}>
          <img
            className="min-w-full min-h-full object-cover"
            src={getAttachmentThumbnailUrl(attachment)}
            onClick={handleImageClick}
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

        <PreviewImageDialog
          open={previewImage.open}
          onOpenChange={(open) => setPreviewImage((prev) => ({ ...prev, open }))}
          imgUrls={previewImage.urls}
          initialIndex={previewImage.index}
        />
      </>
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
        return <FileArchiveIcon onClick={previewResource} strokeWidth={strokeWidth} className="w-full h-auto" />;
      case "application/x-java-archive":
        return <BinaryIcon strokeWidth={strokeWidth} className="w-full h-auto" />;
      default:
        return <FileIcon strokeWidth={strokeWidth} className="w-full h-auto" />;
    }
  };

  return (
    <div onClick={previewResource} className={cn(className, "max-w-16 opacity-50")}>
      {getAttachmentIcon()}
    </div>
  );
};

export default React.memo(AttachmentIcon);
