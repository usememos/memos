import classNames from "classnames";
import { getResourceUrl } from "@/utils/resource";
import Icon from "./Icon";
import SquareDiv from "./kit/SquareDiv";
import showPreviewImageDialog from "./PreviewImageDialog";

interface Props {
  className: string;
  resource: Resource;
}

const ResourceIcon = (props: Props) => {
  const { className, resource } = props;

  if (resource.type.includes("image")) {
    const url = getResourceUrl(resource);
    return (
      <SquareDiv key={resource.id} className={classNames("cursor-pointer rounded hover:shadow", className)}>
        <img
          className="min-h-full min-w-full w-auto h-auto rounded"
          src={resource.externalLink ? url : url + "?thumbnail=1"}
          onClick={() => showPreviewImageDialog([url], 0)}
          decoding="async"
          loading="lazy"
        />
      </SquareDiv>
    );
  }

  const ResourceIcon = Icon.FileText;
  return <ResourceIcon className={className} />;
};

export default ResourceIcon;
