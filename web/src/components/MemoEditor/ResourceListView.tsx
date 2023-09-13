import Icon from "../Icon";
import ResourceIcon from "../ResourceIcon";

interface Props {
  resourceList: Resource[];
  setResourceList: (resourceList: Resource[]) => void;
}

const ResourceListView = (props: Props) => {
  const { resourceList, setResourceList } = props;

  const handleDeleteResource = async (resourceId: ResourceId) => {
    setResourceList(resourceList.filter((resource) => resource.id !== resourceId));
  };

  return (
    <>
      {resourceList.length > 0 && (
        <div className="w-full flex flex-row justify-start flex-wrap gap-2 mt-2">
          {resourceList.map((resource) => {
            return (
              <div
                key={resource.id}
                className="max-w-full flex flex-row justify-start items-center flex-nowrap gap-x-1 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-gray-500"
              >
                <ResourceIcon resource={resource} className="!w-4 !h-auto !opacity-100" />
                <span className="text-sm max-w-[8rem] truncate">{resource.filename}</span>
                <Icon.X
                  className="w-4 h-auto cursor-pointer opacity-60 hover:opacity-100"
                  onClick={() => handleDeleteResource(resource.id)}
                />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default ResourceListView;
