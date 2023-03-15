import React from "react";
import Icon from "./Icon";
import "../less/resource-cover.less";

interface ResourceCoverProps {
  resource: Resource;
}

const ResourceCover = ({ resource }: ResourceCoverProps) => {
  switch (resource.type) {
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
