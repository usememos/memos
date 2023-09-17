import classNames from "classnames";
import { absolutifyLink } from "@/helpers/utils";
import { Resource } from "@/types/proto-grpcweb/api/v2/resource_service";
import { getResourceType, getResourceUrl } from "@/utils/resource";
import MemoResource from "./MemoResource";
import showPreviewImageDialog from "./PreviewImageDialog";
import SquareDiv from "./kit/SquareDiv";
import "@/less/memo-resources.less";

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
          <div className="mt-2 max-w-[90%] max-h-64 flex justify-center items-center border rounded overflow-hidden hide-scrollbar hover:shadow-md">
            <img
              className="cursor-pointer min-h-full w-auto min-w-full object-cover"
              src={getResourceUrl(imageResourceList[0])}
              onClick={() => handleImageClick(getResourceUrl(imageResourceList[0]))}
              decoding="async"
              loading="lazy"
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
                    className="cursor-pointer min-h-full w-auto min-w-full object-cover"
                    src={resource.externalLink ? url : url + "?thumbnail=1"}
                    onClick={() => handleImageClick(url)}
                    decoding="async"
                    loading="lazy"
                  />
                </SquareDiv>
              );
            })}
          </div>
        ))}

      <div className={`resource-wrapper ${className || ""}`}>
        {videoResourceList.length > 0 && (
          <div className="images-wrapper">
            {videoResourceList.map((resource) => {
              const url = getResourceUrl(resource);
              return (
                <SquareDiv key={resource.id} className="memo-resource">
                  <video preload="metadata" controls key={resource.id}>
                    <source src={absolutifyLink(url)} type={resource.type} />
                  </video>
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
