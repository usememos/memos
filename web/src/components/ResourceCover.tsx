import React from "react";
import Icon from "./Icon";
import { getResourceUrl } from "@/utils/resource";
import showPreviewImageDialog from "./PreviewImageDialog";
import "@/less/resource-cover.less";

interface ResourceCoverProps {
  resource: Resource;
}

const getResourceType = (resource: Resource) => {
  if (resource.type.startsWith("image")) {
    return "image/*";
  } else if (resource.type.startsWith("video")) {
    return "video/*";
  } else if (resource.type.startsWith("audio")) {
    return "audio/*";
  } else if (resource.type.startsWith("text")) {
    return "text/*";
  } else if (resource.type.startsWith("application/epub+zip")) {
    return "application/epub+zip";
  } else if (resource.type.startsWith("application/pdf")) {
    return "application/pdf";
  } else if (resource.type.includes("word")) {
    return "application/msword";
  } else if (resource.type.includes("excel")) {
    return "application/msexcel";
  } else if (resource.type.startsWith("application/zip")) {
    return "application/zip";
  } else if (resource.type.startsWith("application/x-java-archive")) {
    return "application/x-java-archive";
  } else {
    return "application/octet-stream";
  }
};

const ResourceCover = ({ resource }: ResourceCoverProps) => {
  const resourceType = getResourceType(resource);
  const resourceUrl = getResourceUrl(resource);
  switch (resourceType) {
    case "image/*":
      return (
        <img className="resource-cover h-20 w-20" src={resourceUrl + "?thumbnail=1"} onClick={() => showPreviewImageDialog(resourceUrl)} />
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
