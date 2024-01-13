import { memo } from "react";
import { absolutifyLink } from "@/helpers/utils";
import { Resource } from "@/types/proto/api/v2/resource_service";
import { getResourceType, getResourceUrl } from "@/utils/resource";
import MemoResource from "./MemoResource";
import showPreviewImageDialog from "./PreviewImageDialog";
import SquareDiv from "./kit/SquareDiv";

const MemoResourceListView = ({ resourceList = [] }: { resourceList: Resource[] }) => {
  const mediaResources: Resource[] = [];
  const otherResources: Resource[] = [];

  resourceList.forEach((resource) => {
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

  const MediaCard = ({ resource, thumbnail }: { resource: Resource; thumbnail?: boolean }) => {
    const type = getResourceType(resource);
    const url = getResourceUrl(resource);

    if (type === "image/*") {
      return (
        <img
          className="cursor-pointer min-h-full w-auto object-cover"
          src={resource.externalLink ? url : `${url}${thumbnail ? "?thumbnail=1" : ""}`}
          onClick={() => handleImageClick(url)}
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
          src={absolutifyLink(url)}
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
        <div className="mt-2 max-w-full flex justify-center items-center border dark:border-zinc-800 rounded overflow-hidden hide-scrollbar hover:shadow-md">
          <MediaCard resource={mediaResources[0]} />
        </div>
      );
    }

    const cards = resources.map((resource) => (
      <SquareDiv
        key={resource.id}
        className="flex justify-center items-center border dark:border-zinc-900 rounded overflow-hidden hide-scrollbar hover:shadow-md"
      >
        <MediaCard resource={resource} thumbnail />
      </SquareDiv>
    ));

    if (resources.length === 2 || resources.length === 4) {
      return <div className="w-full mt-2 grid gap-2 grid-cols-2">{cards}</div>;
    }

    return <div className="w-full mt-2 grid gap-2 grid-cols-2 sm:grid-cols-3">{cards}</div>;
  };

  const OtherList = ({ resources = [] }: { resources: Resource[] }) => {
    if (resources.length === 0) return <></>;

    return (
      <div className="w-full flex flex-row justify-start flex-wrap mt-2">
        {otherResources.map((resource) => (
          <MemoResource key={resource.id} className="my-1 mr-2" resource={resource} />
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
