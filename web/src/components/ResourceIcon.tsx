import Icon from "./Icon";

interface Props {
  className: string;
  resourceType: string;
}

const ResourceIcon = (props: Props) => {
  const { className, resourceType } = props;

  let ResourceIcon = Icon.FileText;
  if (resourceType.includes("image")) {
    ResourceIcon = Icon.Image;
  }

  return <ResourceIcon className={className} />;
};

export default ResourceIcon;
