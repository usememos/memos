import { useEffect, useState } from "react";
import * as utils from "../helpers/utils";
import useLoading from "../hooks/useLoading";
import { resourceService } from "../services";
import Dropdown from "./common/Dropdown";
import { generateDialog } from "./Dialog";
import { showCommonDialog } from "./Dialog/CommonDialog";
import toastHelper from "./Toast";
import Icon from "./Icon";
import "../less/resources-dialog.less";

interface Props extends DialogProps {}

const ResourcesDialog: React.FC<Props> = (props: Props) => {
  const { destroy } = props;
  const loadingState = useLoading();
  const [resources, setResources] = useState<Resource[]>([]);

  useEffect(() => {
    fetchResources()
      .catch((error) => {
        toastHelper.error("Failed to fetch archived memos: ", error);
      })
      .finally(() => {
        loadingState.setFinish();
      });
  }, []);

  const fetchResources = async () => {
    const data = await resourceService.getResourceList();
    setResources(data);
  };

  const handleCopyResourceLinkBtnClick = (resource: Resource) => {
    utils.copyTextToClipboard(`${window.location.origin}/h/r/${resource.id}/${resource.filename}`);
    toastHelper.success("Succeed to copy resource link to clipboard");
  };

  const handleDeleteResourceBtnClick = (resource: Resource) => {
    showCommonDialog({
      title: `Delete Resource`,
      content: `Are you sure to delete this resource? THIS ACTION IS IRREVERSIABLE.❗️`,
      style: "warning",
      onConfirm: async () => {
        await resourceService.deleteResourceById(resource.id);
        await fetchResources();
      },
    });
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">
          <span className="icon-text">🌄</span>
          Resources
        </p>
        <button className="btn close-btn" onClick={destroy}>
          <Icon.X className="icon-img" />
        </button>
      </div>
      <div className="dialog-content-container">
        <div className="tip-text-container">(👨‍💻WIP) View your static resources in memos. e.g. images</div>
        <div className="actions-container"></div>
        {loadingState.isLoading ? (
          <div className="loading-text-container">
            <p className="tip-text">fetching data...</p>
          </div>
        ) : (
          <div className="resource-table-container">
            <div className="fields-container">
              <span className="field-text">ID</span>
              <span className="field-text name-text">NAME</span>
              <span className="field-text">TYPE</span>
              <span></span>
            </div>
            {resources.map((resource) => (
              <div key={resource.id} className="resource-container">
                <span className="field-text">{resource.id}</span>
                <span className="field-text name-text">{resource.filename}</span>
                <span className="field-text">{resource.type}</span>
                <div className="buttons-container">
                  <Dropdown className="actions-dropdown">
                    <button onClick={() => handleCopyResourceLinkBtnClick(resource)}>Copy Link</button>
                    <button className="delete-btn" onClick={() => handleDeleteResourceBtnClick(resource)}>
                      Delete
                    </button>
                  </Dropdown>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default function showResourcesDialog() {
  generateDialog(
    {
      className: "resources-dialog",
      useAppContext: true,
    },
    ResourcesDialog,
    {}
  );
}
