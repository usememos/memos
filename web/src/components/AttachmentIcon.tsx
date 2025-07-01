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
import { cn } from "@/lib/utils";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import showPreviewImageDialog from "./PreviewImageDialog";
import SquareDiv from "./kit/SquareDiv";

interface Props {
  attachment: Attachment;
  className?: string;
  strokeWidth?: number;
}

const AttachmentIcon = (props: Props) => {
  const { attachment } = props;
  const resourceType = getAttachmentType(attachment);
  const resourceUrl = getAttachmentUrl(attachment);
  const className = cn("w-full h-auto", props.className);
  const strokeWidth = props.strokeWidth;

  const previewResource = () => {
    window.open(resourceUrl);
  };

  if (resourceType === "image/*") {
    return (
      <SquareDiv className={cn(className, "flex items-center justify-center overflow-clip")}>
        <img
          className="min-w-full min-h-full object-cover"
          src={attachment.externalLink ? resourceUrl : resourceUrl + "?thumbnail=true"}
          onClick={() => showPreviewImageDialog(resourceUrl)}
          decoding="async"
          loading="lazy"
        />
      </SquareDiv>
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
