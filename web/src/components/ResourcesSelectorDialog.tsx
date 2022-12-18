import { Checkbox, Tooltip } from "@mui/joy";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useLoading from "../hooks/useLoading";
import { useEditorStore, useResourceStore } from "../store/module";
import Icon from "./Icon";
import toastHelper from "./Toast";
import { generateDialog } from "./Dialog";
import showPreviewImageDialog from "./PreviewImageDialog";
import "../less/resources-selector-dialog.less";

type Props = DialogProps;

interface State {
  checkedArray: boolean[];
}

const ResourcesSelectorDialog: React.FC<Props> = (props: Props) => {
  const { destroy } = props;
  const { t } = useTranslation();
  const loadingState = useLoading();
  const editorStore = useEditorStore();
  const resourceStore = useResourceStore();
  const resources = resourceStore.state.resources;
  const [state, setState] = useState<State>({
    checkedArray: [],
  });

  useEffect(() => {
    resourceStore
      .fetchResourceList()
      .catch((error) => {
        console.error(error);
        toastHelper.error(error.response.data.message);
      })
      .finally(() => {
        loadingState.setFinish();
      });
  }, []);

  useEffect(() => {
    const checkedResourceIdArray = editorStore.state.resourceList.map((resource) => resource.id);
    setState({
      checkedArray: resources.map((resource) => {
        return checkedResourceIdArray.includes(resource.id);
      }),
    });
  }, [resources]);

  const getResourceUrl = useCallback((resource: Resource) => {
    return `${window.location.origin}/o/r/${resource.id}/${resource.filename}`;
  }, []);

  const handlePreviewBtnClick = (resource: Resource) => {
    const resourceUrl = getResourceUrl(resource);
    if (resource.type.startsWith("image")) {
      showPreviewImageDialog(
        resources.filter((r) => r.type.startsWith("image")).map((r) => getResourceUrl(r)),
        resources.findIndex((r) => r.id === resource.id)
      );
    } else {
      window.open(resourceUrl);
    }
  };

  const handleCheckboxChange = (index: number) => {
    const newCheckedArr = state.checkedArray;
    newCheckedArr[index] = !newCheckedArr[index];
    setState({
      checkedArray: newCheckedArr,
    });
  };

  const handleConfirmBtnClick = () => {
    const resourceList = resources.filter((_, index) => {
      return state.checkedArray[index];
    });
    editorStore.setResourceList(resourceList);
    destroy();
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
        {loadingState.isLoading ? (
          <div className="loading-text-container">
            <p className="tip-text">{t("resources.fetching-data")}</p>
          </div>
        ) : (
          <div className="resource-table-container">
            <div className="fields-container">
              <span className="field-text id-text">ID</span>
              <span className="field-text name-text">NAME</span>
              <span></span>
            </div>
            {resources.length === 0 ? (
              <p className="tip-text">{t("resources.no-resources")}</p>
            ) : (
              resources.map((resource, index) => (
                <div key={resource.id} className="resource-container">
                  <span className="field-text id-text">{resource.id}</span>
                  <Tooltip placement="top-start" title={resource.filename}>
                    <span className="field-text name-text">{resource.filename}</span>
                  </Tooltip>
                  <div className="flex justify-end">
                    <Icon.Eye
                      className=" text-left text-sm leading-6 px-1 mr-2 cursor-pointer hover:opacity-80"
                      onClick={() => handlePreviewBtnClick(resource)}
                    >
                      {t("resources.preview")}
                    </Icon.Eye>
                    <Checkbox checked={state.checkedArray[index]} onChange={() => handleCheckboxChange(index)} />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        <div className="flex justify-between w-full mt-2 px-2">
          <span className="text-sm font-mono text-gray-400 leading-8">
            {t("message.count-selected-resources")}: {state.checkedArray.filter((checked) => checked).length}
          </span>
          <div className="flex flex-row justify-start items-center">
            <div
              className="text-sm cursor-pointer px-3 py-1 rounded flex flex-row justify-center items-center border border-blue-600 text-blue-600 bg-blue-50 hover:opacity-80"
              onClick={handleConfirmBtnClick}
            >
              <Icon.PlusSquare className=" w-4 h-auto mr-1" />
              <span>{t("common.confirm")}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default function showResourcesSelectorDialog() {
  generateDialog(
    {
      className: "resources-selector-dialog",
    },
    ResourcesSelectorDialog,
    {}
  );
}
