import { absolutifyLink } from "../helpers/utils";
import Icon from "./Icon";
import SquareDiv from "./common/SquareDiv";
import showPreviewImageDialog from "./PreviewImageDialog";
import "../less/memo-resources.less";

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

const MemoResources: React.FC<Props> = (props: Props) => {
  const { className, resourceList } = {
    ...getDefaultProps(),
    ...props,
  };
  const availableResourceList = resourceList.filter((resource) => resource.type.startsWith("image") || resource.type.startsWith("video"));
  const otherResourceList = resourceList.filter((resource) => !availableResourceList.includes(resource));

  const handlePreviewBtnClick = (resource: Resource) => {
    const resourceUrl = `${window.location.origin}/o/r/${resource.id}/${resource.filename}`;
    window.open(resourceUrl);
  };

  const imgUrls = availableResourceList
    .filter((resource) => resource.type.startsWith("image"))
    .map((resource) => {
      return `/o/r/${resource.id}/${resource.filename}`;
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
              const url = `/o/r/${resource.id}/${resource.filename}`;
              if (resource.type.startsWith("image")) {
                return (
                  <SquareDiv key={resource.id} className="memo-resource">
                    <img src={absolutifyLink(url)} onClick={() => handleImageClick(url)} decoding="async" loading="lazy" />
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
      <div className="other-resource-wrapper">
        {otherResourceList.map((resource) => {
          return (
            <div className="other-resource-container" key={resource.id} onClick={() => handlePreviewBtnClick(resource)}>
              <Icon.FileText className="icon-img" />
              <span className="name-text">{resource.filename}</span>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default MemoResources;
