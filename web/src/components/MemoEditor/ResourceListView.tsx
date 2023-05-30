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
                className="max-w-full flex flex-row justify-start items-center flex-nowrap bg-gray-100 dark:bg-zinc-800 hover:opacity-80 px-2 py-1 rounded cursor-pointer text-gray-500"
              >
                <ResourceIcon resourceType={resource.type} className="w-4 h-auto mr-1" />
                <span className="text-sm max-w-xs truncate font-mono">{resource.filename}</span>
                <Icon.X className="w-4 h-auto ml-1 hover:opacity-80" onClick={() => handleDeleteResource(resource.id)} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default ResourceListView;
