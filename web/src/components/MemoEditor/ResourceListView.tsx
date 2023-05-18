import { useEditorStore } from "@/store/module";
import Icon from "../Icon";
import ResourceIcon from "../ResourceIcon";

const ResourceListView = () => {
  const editorStore = useEditorStore();
  const editorState = editorStore.state;

  const handleDeleteResource = async (resourceId: ResourceId) => {
    editorStore.setResourceList(editorState.resourceList.filter((resource) => resource.id !== resourceId));
  };

  return (
    <>
      {editorState.resourceList && editorState.resourceList.length > 0 && (
        <div className="w-full flex flex-row justify-start flex-wrap gap-2 mt-2">
          {editorState.resourceList.map((resource) => {
            return (
              <div
                key={resource.id}
                className="max-w-full flex flex-row justify-start items-center flex-nowrap bg-gray-100 px-2 py-1 rounded cursor-pointer text-gray-500 hover:bg-gray-200 dark:opacity-60"
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
