import { absolutifyLink } from "@/helpers/utils";
import { getResourceUrl } from "@/utils/resource";
import SquareDiv from "./kit/SquareDiv";
import showPreviewImageDialog from "./PreviewImageDialog";
import MemoResource from "./MemoResource";
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
  const availableResourceList = resourceList.filter((resource) => resource.type.startsWith("image") || resource.type.startsWith("video"));
  const otherResourceList = resourceList.filter((resource) => !availableResourceList.includes(resource));

  const imgUrls = availableResourceList
    .filter((resource) => resource.type.startsWith("image"))
    .map((resource) => {
      return getResourceUrl(resource);
    });

  const handleImageClick = (imgUrl: string) => {
    const index = imgUrls.findIndex((url) => url === imgUrl);
    showPreviewImageDialog(imgUrls, index);
  };

  return (
    <>
      <div className={`resource-wrapper ${className || ""}`}>
        {availableResourceList.length > 0 && (
          <div className="images-wrapper">
            {availableResourceList.map((resource) => {
              const url = getResourceUrl(resource);
              if (resource.type.startsWith("image")) {
                return (
                  <SquareDiv key={resource.id} className="memo-resource">
                    <img src={absolutifyLink(url) + "?thumbnail=1"} onClick={() => handleImageClick(url)} decoding="async" loading="lazy" />
                  </SquareDiv>
                );
              } else if (resource.type.startsWith("video")) {
                return (
                  <SquareDiv key={resource.id} className="memo-resource">
                    <video preload="metadata" controls key={resource.id}>
                      <source src={absolutifyLink(url)} type={resource.type} />
                    </video>
                  </SquareDiv>
                );
              } else {
                return null;
              }
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
