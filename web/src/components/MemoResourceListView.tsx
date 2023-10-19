import classNames from "classnames";
import { absolutifyLink } from "@/helpers/utils";
import { Resource } from "@/types/proto/api/v2/resource_service";
import { getResourceType, getResourceUrl } from "@/utils/resource";
import MemoResource from "./MemoResource";
import showPreviewImageDialog from "./PreviewImageDialog";
import SquareDiv from "./kit/SquareDiv";

interface Props {
  resourceList: Resource[];
  className?: string;
}

const getDefaultProps = (): Props => {
  return {
    className: "",
    resourceList: [],
  };
};

const MemoResourceListView: React.FC<Props> = (props: Props) => {
  const { className, resourceList } = {
    ...getDefaultProps(),
    ...props,
  };
  const imageResourceList = resourceList.filter((resource) => getResourceType(resource).startsWith("image"));
  const videoResourceList = resourceList.filter((resource) => resource.type.startsWith("video"));
  const otherResourceList = resourceList.filter(
    (resource) => !imageResourceList.includes(resource) && !videoResourceList.includes(resource)
  );

  const imgUrls = imageResourceList.map((resource) => {
    return getResourceUrl(resource);
  });

  const handleImageClick = (imgUrl: string) => {
    const index = imgUrls.findIndex((url) => url === imgUrl);
    showPreviewImageDialog(imgUrls, index);
  };

  return (
    <>
      {imageResourceList.length > 0 &&
        (imageResourceList.length === 1 ? (
          <div className="mt-2 max-w-full max-h-72 flex justify-center items-center border dark:border-zinc-800 rounded overflow-hidden hide-scrollbar hover:shadow-md">
            <img
              className="cursor-pointer min-h-full w-auto object-cover"
              src={getResourceUrl(imageResourceList[0])}
              onClick={() => handleImageClick(getResourceUrl(imageResourceList[0]))}
              decoding="async"
            />
          </div>
        ) : (
          <div
            className={classNames(
              "w-full mt-2 grid gap-2 grid-cols-2",
              imageResourceList.length === 4 ? "sm:grid-cols-2" : "sm:grid-cols-3"
            )}
          >
            {imageResourceList.map((resource) => {
              const url = getResourceUrl(resource);
              return (
                <SquareDiv
                  key={resource.id}
                  className="flex justify-center items-center border dark:border-zinc-900 rounded overflow-hidden hide-scrollbar hover:shadow-md"
                >
                  <img
                    className="cursor-pointer min-h-full w-auto object-cover"
                    src={resource.externalLink ? url : url + "?thumbnail=1"}
                    onClick={() => handleImageClick(url)}
                    decoding="async"
                  />
                </SquareDiv>
              );
            })}
          </div>
        ))}

      <div className={`w-full flex flex-col justify-start items-start ${className || ""}`}>
        {videoResourceList.length > 0 && (
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {videoResourceList.map((resource) => {
              const url = getResourceUrl(resource);
              return (
                <SquareDiv key={resource.id} className="shadow rounded overflow-hidden hide-scrollbar">
                  <video
                    className="cursor-pointer w-full h-full object-contain bg-zinc-100 dark:bg-zinc-800"
                    preload="metadata"
                    crossOrigin="anonymous"
                    src={absolutifyLink(url)}
                    controls
                  ></video>
                </SquareDiv>
              );
            })}
          </div>
        )}
      </div>

      {otherResourceList.length > 0 && (
        <div className="w-full flex flex-row justify-start flex-wrap mt-2">
          {otherResourceList.map((resource) => {
            return <MemoResource key={resource.id} className="my-1 mr-2" resource={resource} />;
          })}
        </div>
      )}
    </>
  );
};

export default MemoResourceListView;
