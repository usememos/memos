import { useEffect, useState } from "react";
import * as utils from "../helpers/utils";
import useI18n from "../hooks/useI18n";
import useLoading from "../hooks/useLoading";
import { resourceService } from "../services";
import Dropdown from "./common/Dropdown";
import { generateDialog } from "./Dialog";
import { showCommonDialog } from "./Dialog/CommonDialog";
import Icon from "./Icon";
import toastHelper from "./Toast";
import "../less/resources-dialog.less";

interface Props extends DialogProps {}

interface State {
  resources: Resource[];
  isUploadingResource: boolean;
}

const ResourcesDialog: React.FC<Props> = (props: Props) => {
  const { destroy } = props;
  const { t } = useI18n();
  const loadingState = useLoading();
  const [state, setState] = useState<State>({
    resources: [],
    isUploadingResource: false,
  });

  useEffect(() => {
    fetchResources()
      .catch((error) => {
        console.error(error);
        toastHelper.error(error.response.data.message);
      })
      .finally(() => {
        loadingState.setFinish();
      });
  }, []);

  const fetchResources = async () => {
    const data = await resourceService.getResourceList();
    setState({
      ...state,
      resources: data,
    });
  };

  const handleUploadFileBtnClick = async () => {
    if (state.isUploadingResource) {
      return;
    }

    const inputEl = document.createElement("input");
    inputEl.type = "file";
    inputEl.multiple = false;
    inputEl.accept = "image/png, image/gif, image/jpeg";
    inputEl.onchange = async () => {
      if (!inputEl.files || inputEl.files.length === 0) {
        return;
      }

      setState({
        ...state,
        isUploadingResource: true,
      });

      const file = inputEl.files[0];
      try {
        await resourceService.upload(file);
      } catch (error: any) {
        console.error(error);
        toastHelper.error(error.response.data.message);
      } finally {
        setState({
          ...state,
          isUploadingResource: false,
        });
        await fetchResources();
      }
    };
    inputEl.click();
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
          {t("sidebar.resources")}
        </p>
        <button className="btn close-btn" onClick={destroy}>
          <Icon.X className="icon-img" />
        </button>
      </div>
      <div className="dialog-content-container">
        <div className="tip-text-container">(👨‍💻WIP) View your static resources in memos. e.g. images</div>
        <div className="upload-resource-container" onClick={() => handleUploadFileBtnClick()}>
          <div className="upload-resource-btn">
            <Icon.File className="icon-img" />
            <span>Upload</span>
          </div>
        </div>
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
            {state.resources.length === 0 ? (
              <p className="tip-text">No resource.</p>
            ) : (
              state.resources.map((resource) => (
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
              ))
            )}
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
    },
    ResourcesDialog,
    {}
  );
}
