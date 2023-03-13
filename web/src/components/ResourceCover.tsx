import React from "react";
import Icon from "./Icon";

interface ResourceCoverProps {
  resource: Resource;
}

const ResourceCover = ({ resource }: ResourceCoverProps) => {
  switch (resource.type) {
    case "image/*":
      return <Icon.FileImage className="w-full h-full ml-auto mr-auto mt-5" />;
    case "video/*":
      return <Icon.FileVideo2 className="w-full h-full ml-auto mr-auto mt-5" />;
    case "audio/*":
      return <Icon.FileAudio className="w-full h-full ml-auto mr-auto mt-5" />;
    case "text/*":
      return <Icon.FileText className="w-full h-full ml-auto mr-auto mt-5" />;
    case "application/epub+zip":
      return <Icon.Book className="w-full h-full ml-auto mr-auto mt-5" />;
    case "application/pdf":
      return <Icon.Book className="w-full h-full ml-auto mr-auto mt-5" />;
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return <Icon.FileEdit className="w-full h-full ml-auto mr-auto mt-5" />;
    case "application/msword":
      return <Icon.FileEdit className="w-full h-full ml-auto mr-auto mt-5" />;
    default:
      return <Icon.File className="w-full h-full ml-auto mr-auto mt-5" />;
  }
};

export default React.memo(ResourceCover);
