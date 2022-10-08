import copy from "copy-to-clipboard";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useLoading from "../hooks/useLoading";
import { resourceService } from "../services";
import Dropdown from "./common/Dropdown";
import { generateDialog } from "./Dialog";
import { showCommonDialog } from "./Dialog/CommonDialog";
import showPreviewImageDialog from "./PreviewImageDialog";
import Icon from "./Icon";
import toastHelper from "./Toast";
import "../less/resources-dialog.less";

type Props = DialogProps;

interface State {
  resources: Resource[];
  isUploadingResource: boolean;
}

const ResourcesDialog: React.FC<Props> = (props: Props) => {
  const { destroy } = props;
  const { t } = useTranslation();
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
    inputEl.style.position = "fixed";
    inputEl.style.top = "-100vh";
    inputEl.style.left = "-100vw";
    document.body.appendChild(inputEl);
    inputEl.type = "file";
    inputEl.multiple = true;
    inputEl.accept = "*";
    inputEl.onchange = async () => {
      if (!inputEl.files || inputEl.files.length === 0) {
        return;
      }

      setState({
        ...state,
        isUploadingResource: true,
      });

      for (const file of inputEl.files) {
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
        }
      }

      document.body.removeChild(inputEl);
      await fetchResources();
    };
    inputEl.click();
  };

  const handlPreviewBtnClick = (resource: Resource) => {
    const resourceUrl = `${window.location.origin}/o/r/${resource.id}/${resource.filename}`;
    if (resource.type.startsWith("image")) {
      showPreviewImageDialog(resourceUrl);
    } else {
      window.open(resourceUrl);
    }
  };

  const handleCopyResourceLinkBtnClick = (resource: Resource) => {
    copy(`${window.location.origin}/o/r/${resource.id}/${resource.filename}`);
    toastHelper.success("Succeed to copy resource link to clipboard");
  };

  const handleDeleteResourceBtnClick = (resource: Resource) => {
    let warningText = t("resources.warning-text");
    if (resource.linkedMemoAmount > 0) {
      warningText = warningText + `\n${t("resources.linked-amount")}: ${resource.linkedMemoAmount}`;
    }

    showCommonDialog({
      title: t("resources.delete-resource"),
      content: warningText,
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
        <div className="upload-resource-container" onClick={() => handleUploadFileBtnClick()}>
          <div className="upload-resource-btn">
            <Icon.File className="icon-img" />
            <span>{t("resources.upload")}</span>
          </div>
        </div>
        {loadingState.isLoading ? (
          <div className="loading-text-container">
            <p className="tip-text">{t("resources.fetching-data")}</p>
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
              <p className="tip-text">{t("resources.no-resources")}</p>
            ) : (
              state.resources.map((resource) => (
                <div key={resource.id} className="resource-container">
                  <span className="field-text">{resource.id}</span>
                  <span className="field-text name-text">{resource.filename}</span>
                  <span className="field-text">{resource.type}</span>
                  <div className="buttons-container">
                    <Dropdown
                      actionsClassName="!w-28"
                      actions={
                        <>
                          <button
                            className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100"
                            onClick={() => handlPreviewBtnClick(resource)}
                          >
                            {t("resources.preview")}
                          </button>
                          <button
                            className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100"
                            onClick={() => handleCopyResourceLinkBtnClick(resource)}
                          >
                            {t("resources.copy-link")}
                          </button>
                          <button
                            className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded text-red-600 hover:bg-gray-100"
                            onClick={() => handleDeleteResourceBtnClick(resource)}
                          >
                            {t("common.delete")}
                          </button>
                        </>
                      }
                    />
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
