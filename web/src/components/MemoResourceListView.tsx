import { memo } from "react";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { cn } from "@/utils";
import { getResourceType, getResourceUrl } from "@/utils/resource";
import MemoResource from "./MemoResource";
import showPreviewImageDialog from "./PreviewImageDialog";

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

  const MediaCard = ({ resource, className }: { resource: Resource; className?: string }) => {
    const type = getResourceType(resource);
    const resourceUrl = getResourceUrl(resource);

    if (type === "image/*") {
      return (
        <img
          className={cn("cursor-pointer h-full w-auto rounded-lg border dark:border-zinc-800 object-contain hover:opacity-80", className)}
          src={resource.externalLink ? resourceUrl : resourceUrl + "?thumbnail=true"}
          onClick={() => handleImageClick(resourceUrl)}
          decoding="async"
          loading="lazy"
        />
      );
    } else if (type === "video/*") {
      return (
        <video
          className={cn(
            "cursor-pointer h-full w-auto rounded-lg border dark:border-zinc-800 object-contain bg-zinc-100 dark:bg-zinc-800",
            className,
          )}
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
    if (resources.length === 1) {
      const resource = mediaResources[0];
      return (
        <div className="max-w-full flex flex-col justify-start items-start overflow-hidden hide-scrollbar">
          <MediaCard className="max-h-64" resource={resource} />
          <span className="max-w-full text-xs pl-1 text-gray-400 dark:text-zinc-500 truncate">{resource.filename}</span>
        </div>
      );
    }

    const cards = resources.map((resource) => (
      <div key={resource.name} className="max-w-[70%] flex flex-col justify-start items-start shrink-0">
        <MediaCard className="max-h-64" resource={resource} />
        <span className="max-w-full text-xs pl-1 text-gray-400 dark:text-zinc-500 truncate">{resource.filename}</span>
      </div>
    ));

    return <div className="w-full flex flex-row justify-start overflow-auto gap-2">{cards}</div>;
  };

  const OtherList = ({ resources = [] }: { resources: Resource[] }) => {
    if (resources.length === 0) return <></>;

    return (
      <div className="w-full flex flex-row justify-start overflow-auto gap-2">
        {otherResources.map((resource) => (
          <MemoResource key={resource.name} resource={resource} />
        ))}
      </div>
    );
  };

  return (
    <>
      {mediaResources.length > 0 && <MediaList resources={mediaResources} />}
      <OtherList resources={otherResources} />
    </>
  );
};

export default memo(MemoResourceListView);
