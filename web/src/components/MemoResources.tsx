import Image from "./Image";
import Icon from "./Icon";
import "../less/memo-resources.less";

interface Props {
  resourceList: Resource[];
  className?: string;
  style?: "row" | "col";
}

const getDefaultProps = (): Props => {
  return {
    className: "",
    style: "row",
    resourceList: [],
  };
};

const MemoResources: React.FC<Props> = (props: Props) => {
  const { className, style, resourceList } = {
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

  return (
    <div className={`resource-wrapper ${className || ""}`}>
      {availableResourceList.length > 0 && (
        <div className={`images-wrapper ${style}`}>
          {availableResourceList.map((resource) => {
            const url = `/o/r/${resource.id}/${resource.filename}`;
            if (resource.type.startsWith("image")) {
              return (
                <Image className="memo-resource" key={resource.id} imgUrls={imgUrls} index={imgUrls.findIndex((item) => item === url)} />
              );
            } else {
              return <video className="memo-resource" controls key={resource.id} src={url} />;
            }
          })}
        </div>
      )}
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
    </div>
  );
};

export default MemoResources;
