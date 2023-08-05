import { ImageList, ImageListItem, useMediaQuery } from "@mui/material";
import { absolutifyLink } from "@/helpers/utils";
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
  const matches = useMediaQuery("(min-width:640px)");
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
      {imageResourceList.length > 0 && (
        <div className="w-full mt-2">
          <ImageList variant="masonry" cols={matches ? 3 : 2} gap={8}>
            {imageResourceList.map((resource) => {
              const url = getResourceUrl(resource);
              return (
                <ImageListItem onClick={() => handleImageClick(url)} key={resource.id}>
                  <img className="shadow rounded" src={url} loading="lazy" />
                </ImageListItem>
              );
            })}
          </ImageList>
        </div>
      )}

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
