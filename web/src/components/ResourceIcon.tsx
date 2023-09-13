import classNames from "classnames";
import React from "react";
import { getResourceType, getResourceUrl } from "@/utils/resource";
import Icon from "./Icon";
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
  const className = classNames("w-full h-auto", props.className);
  const strokeWidth = props.strokeWidth;

  switch (resourceType) {
    case "image/*":
      return (
        <SquareDiv className={classNames(className, "flex items-center justify-center overflow-clip")}>
          <img
            className="max-w-full max-h-full object-cover shadow"
            src={resource.externalLink ? resourceUrl : resourceUrl + "?thumbnail=1"}
            onClick={() => showPreviewImageDialog(resourceUrl)}
          />
        </SquareDiv>
      );
    case "video/*":
      return <Icon.FileVideo2 strokeWidth={strokeWidth} className={classNames(className, "opacity-50")} />;
    case "audio/*":
      return <Icon.FileAudio strokeWidth={strokeWidth} className={classNames(className, "opacity-50")} />;
    case "text/*":
      return <Icon.FileText strokeWidth={strokeWidth} className={classNames(className, "opacity-50")} />;
    case "application/epub+zip":
      return <Icon.Book strokeWidth={strokeWidth} className={classNames(className, "opacity-50")} />;
    case "application/pdf":
      return <Icon.Book strokeWidth={strokeWidth} className={classNames(className, "opacity-50")} />;
    case "application/msword":
      return <Icon.FileEdit strokeWidth={strokeWidth} className={classNames(className, "opacity-50")} />;
    case "application/msexcel":
      return <Icon.SheetIcon strokeWidth={strokeWidth} className={classNames(className, "opacity-50")} />;
    case "application/zip":
      return <Icon.FileArchiveIcon strokeWidth={strokeWidth} className={classNames(className, "opacity-50")} />;
    case "application/x-java-archive":
      return <Icon.BinaryIcon strokeWidth={strokeWidth} className={classNames(className, "opacity-50")} />;
    default:
      return <Icon.File strokeWidth={strokeWidth} className={classNames(className, "opacity-50")} />;
  }
};

export default React.memo(ResourceIcon);
