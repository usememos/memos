import Image from "./Image";
import Icon from "./Icon";
import "../less/memo-resources.less";

interface Props {
  className?: string;
  resourceList: Resource[];
}

const MemoResources: React.FC<Props> = (props: Props) => {
  const { className, resourceList } = props;
  const imageList = resourceList.filter((resource) => resource.type.includes("image"));
  const otherResourceList = resourceList.filter((resource) => !resource.type.includes("image"));

  const handlPreviewBtnClick = (resource: Resource) => {
    const resourceUrl = `${window.location.origin}/o/r/${resource.id}/${resource.filename}`;
    window.open(resourceUrl);
  };

  const imgUrls = imageList.map((resource) => {
    return `/o/r/${resource.id}/${resource.filename}`;
  });

  return (
    <div className={`resource-wrapper ${className || ""}`}>
      {imageList.length > 0 && (
        <div className="images-wrapper">
          {imageList.map((resource, index) => (
            <Image className="memo-img" key={resource.id} imgUrls={imgUrls} index={index} />
          ))}
        </div>
      )}
      <div className="other-resource-wrapper">
        {otherResourceList.map((resource) => {
          return (
            <div className="other-resource-container" key={resource.id} onClick={() => handlPreviewBtnClick(resource)}>
              <Icon.FileText className="icon-img" />
              <span className="name-text">{resource.filename}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MemoResources;
