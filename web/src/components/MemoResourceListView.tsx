import { memo } from "react";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { cn } from "@/utils";
import { getResourceType, getResourceUrl, isResourceEmbeddedInContent } from "@/utils/resource";
import MemoResource from "./MemoResource";
import showPreviewImageDialog from "./PreviewImageDialog";

const MemoResourceListView = ({
  memo,
  resources = [],
  noThumbnailForEmbedded,
  allowFullWidth,
}: {
  memo?: Memo;
  resources: Resource[];
  noThumbnailForEmbedded?: boolean;
  allowFullWidth?: boolean;
}) => {
  const mediaResources: Resource[] = [];
  const otherResources: Resource[] = [];

  resources.forEach((resource) => {
    const type = getResourceType(resource);
    if (type === "image/*" || type === "video/*") {
      let useThumbnail = true;
      if (memo && noThumbnailForEmbedded) useThumbnail = !isResourceEmbeddedInContent(memo.content, resource);

      if (useThumbnail) {
        mediaResources.push(resource);
        return;
      }
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
          data-is-resource-media
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
    const cards = resources.map((resource) => (
      <div
        key={resource.name}
        className={cn(allowFullWidth ? "max-w-full" : "max-w-[70%]", "grow flex flex-col justify-start items-start shrink-0")}
      >
        <MediaCard className="max-h-64 grow" resource={resource} />
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
