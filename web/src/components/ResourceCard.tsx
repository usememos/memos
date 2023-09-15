import { getDateTimeString } from "@/helpers/datetime";
import ResourceIcon from "./ResourceIcon";
import "@/less/resource-card.less";

interface Props {
  resource: Resource;
}

const ResourceCard = ({ resource }: Props) => {
  return (
    <div className="resource-card">
      <div className="w-full flex flex-row justify-center items-center pb-2 pt-4 px-2">
        <ResourceIcon resource={resource} strokeWidth={0.5} />
      </div>
      <div className="w-full flex flex-col justify-start items-center px-1 select-none">
        <div className="w-full text-base text-center text-ellipsis overflow-hidden line-clamp-3">{resource.filename}</div>
        <div className="text-xs text-gray-400 text-center">{getDateTimeString(resource.createdTs)}</div>
      </div>
    </div>
  );
};

export default ResourceCard;
