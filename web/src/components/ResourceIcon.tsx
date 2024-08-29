import clsx from "clsx";
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
import { Resource } from "@/types/proto/api/v1/resource_service";
import { getResourceType, getResourceUrl } from "@/utils/resource";
import showPreviewImageDialog from "./PreviewImageDialog";
import SquareDiv from "./kit/SquareDiv";

interface Props {
  resource: Resource;
  className?: string;
  strokeWidth?: number;
}

const ResourceIcon = (props: Props) => {
  const { resource } = props;
  const resourceType = getResourceType(resource);
  const resourceUrl = getResourceUrl(resource);
  const className = clsx("w-full h-auto", props.className);
  const strokeWidth = props.strokeWidth;

  const previewResource = () => {
    window.open(resourceUrl);
  };

  if (resourceType === "image/*") {
    return (
      <SquareDiv className={clsx(className, "flex items-center justify-center overflow-clip")}>
        <img
          className="min-w-full min-h-full object-cover"
          src={resource.externalLink ? resourceUrl : resourceUrl + "?thumbnail=true"}
          onClick={() => showPreviewImageDialog(resourceUrl)}
          decoding="async"
          loading="lazy"
        />
      </SquareDiv>
    );
  }

  const getResourceIcon = () => {
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
    <div onClick={previewResource} className={clsx(className, "max-w-[4rem] opacity-50")}>
      {getResourceIcon()}
    </div>
  );
};

export default React.memo(ResourceIcon);
