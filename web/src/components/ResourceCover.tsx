import React from "react";
import Icon from "./Icon";
import "../less/resource-cover.less";

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
  } else if (resource.type.startsWith("application/vnd.openxmlformats-officedocument.wordprocessingml.document")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else if (resource.type.startsWith("application/msword")) {
    return "application/msword";
  } else {
    return "application/octet-stream";
  }
};

const ResourceCover = ({ resource }: ResourceCoverProps) => {
  const resourceType = getResourceType(resource);
  switch (resourceType) {
    case "image/*":
      return <Icon.FileImage className="resource-cover" />;
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
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return <Icon.FileEdit className="resource-cover" />;
    case "application/msword":
      return <Icon.FileEdit className="resource-cover" />;
    default:
      return <Icon.File className="resource-cover" />;
  }
};

export default React.memo(ResourceCover);
