import { useEditorStore } from "@/store/module";
import { deleteMemoResource } from "@/helpers/api";
import Icon from "../Icon";
import ResourceIcon from "../ResourceIcon";

const ResourceListView = () => {
  const editorStore = useEditorStore();
  const editorState = editorStore.state;

  const handleDeleteResource = async (resourceId: ResourceId) => {
    editorStore.setResourceList(editorState.resourceList.filter((resource) => resource.id !== resourceId));
    if (editorState.editMemoId) {
      await deleteMemoResource(editorState.editMemoId, resourceId);
    }
  };

  return (
    <>
      {editorState.resourceList && editorState.resourceList.length > 0 && (
        <div className="resource-list-wrapper">
          {editorState.resourceList.map((resource) => {
            return (
              <div key={resource.id} className="resource-container">
                <ResourceIcon resourceType="resource.type" className="icon-img" />
                <span className="name-text">{resource.filename}</span>
                <Icon.X className="close-icon" onClick={() => handleDeleteResource(resource.id)} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};
export default ResourceListView;
