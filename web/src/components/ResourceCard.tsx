import { getDateTimeString } from "@/helpers/datetime";
import { Resource } from "@/types/proto/api/v2/resource_service_pb";
import ResourceIcon from "./ResourceIcon";

interface Props {
  resource: Resource;
}

const ResourceCard = ({ resource }: Props) => {
  return (
    <div className="w-full p-2 relative flex flex-col justify-start hover:shadow hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md">
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
