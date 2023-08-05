import React from "react";
import { getResourceType, getResourceUrl } from "@/utils/resource";
import Icon from "./Icon";
import SquareDiv from "./kit/SquareDiv";
import showPreviewImageDialog from "./PreviewImageDialog";
import "@/less/resource-cover.less";

interface ResourceCoverProps {
  resource: Resource;
}

const ResourceCover = ({ resource }: ResourceCoverProps) => {
  const resourceType = getResourceType(resource);
  const resourceUrl = getResourceUrl(resource);
  switch (resourceType) {
    case "image/*":
      return (
        <SquareDiv className="h-20 w-20 flex items-center justify-center overflow-clip">
          <img
            className="max-w-full max-h-full object-cover shadow"
            src={resource.externalLink ? resourceUrl : resourceUrl + "?thumbnail=1"}
            onClick={() => showPreviewImageDialog(resourceUrl)}
          />
        </SquareDiv>
      );
    case "video/*":
      return <Icon.FileVideo2 className="resource-cover" />;
    case "audio/*":
      return <Icon.FileAudio className="resource-cover" />;
    case "text/*":
      return <Icon.FileText className="resource-cover" />;
    case "application/epub+zip":
      return <Icon.Book className="resource-cover" />;
    case "application/pdf":
      return <Icon.Book className="resource-cover" />;
    case "application/msword":
      return <Icon.FileEdit className="resource-cover" />;
    case "application/msexcel":
      return <Icon.SheetIcon className="resource-cover" />;
    case "application/zip":
      return <Icon.FileArchiveIcon className="resource-cover" />;
    case "application/x-java-archive":
      return <Icon.BinaryIcon className="resource-cover" />;
    default:
      return <Icon.File className="resource-cover" />;
  }
};

export default React.memo(ResourceCover);
