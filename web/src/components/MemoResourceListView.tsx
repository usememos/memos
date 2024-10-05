import { memo } from "react";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { getResourceType, getResourceUrl } from "@/utils/resource";
import MemoResource from "./MemoResource";
import showPreviewImageDialog from "./PreviewImageDialog";
import SquareDiv from "./kit/SquareDiv";

const MemoResourceListView = ({ resources = [] }: { resources: Resource[] }) => {
  const mediaResources: Resource[] = [];
  const otherResources: Resource[] = [];

  resources.forEach((resource) => {
    const type = getResourceType(resource);
    if (type === "image/*" || type === "video/*") {
      mediaResources.push(resource);
      return;
    }

    otherResources.push(resource);
  });

  const handleImageClick = (imgUrl: string) => {
    const imgUrls = mediaResources
      .filter((resource) => getResourceType(resource) === "image/*")
      .map((resource) => getResourceUrl(resource));
    const index = imgUrls.findIndex((url) => url === imgUrl);
    showPreviewImageDialog(imgUrls, index);
  };

  const MediaCard = ({ resource }: { resource: Resource }) => {
    const type = getResourceType(resource);
    const resourceUrl = getResourceUrl(resource);

    if (type === "image/*") {
      return (
        <img
          className="cursor-pointer min-h-full w-auto object-cover"
          src={resource.externalLink ? resourceUrl : resourceUrl + "?thumbnail=true"}
          onClick={() => handleImageClick(resourceUrl)}
          decoding="async"
          loading="lazy"
        />
      );
    } else if (type === "video/*") {
      return (
        <video
          className="cursor-pointer w-full h-full object-contain bg-zinc-100 dark:bg-zinc-800"
          preload="metadata"
          crossOrigin="anonymous"
          src={resourceUrl}
          controls
        />
      );
    } else {
      return <></>;
    }
  };

  const MediaList = ({ resources = [] }: { resources: Resource[] }) => {
    if (resources.length === 0) return <></>;

    if (resources.length === 1) {
      return (
        <div className="max-w-full flex justify-center items-center border dark:border-zinc-800 rounded overflow-hidden hide-scrollbar hover:shadow-md">
          <MediaCard resource={mediaResources[0]} />
        </div>
      );
    }

    const cards = resources.map((resource) => (
      <SquareDiv
        key={resource.name}
        className="flex justify-center items-center border dark:border-zinc-900 rounded overflow-hidden hide-scrollbar hover:shadow-md"
      >
        <MediaCard resource={resource} />
      </SquareDiv>
    ));

    if (resources.length === 2 || resources.length === 4) {
      return <div className="w-full grid gap-2 grid-cols-2">{cards}</div>;
    }

    return <div className="w-full grid gap-2 grid-cols-2 sm:grid-cols-3">{cards}</div>;
  };

  const OtherList = ({ resources = [] }: { resources: Resource[] }) => {
    if (resources.length === 0) return <></>;

    return (
      <div className="w-full flex flex-row justify-start flex-wrap gap-2">
        {otherResources.map((resource) => (
          <MemoResource key={resource.name} resource={resource} />
        ))}
      </div>
    );
  };

  return (
    <>
      <MediaList resources={mediaResources} />
      <OtherList resources={otherResources} />
    </>
  );
};

export default memo(MemoResourceListView);
