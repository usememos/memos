import { Button, Checkbox } from "@mui/joy";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useLoading from "../hooks/useLoading";
import { useEditorStore, useResourceStore } from "../store/module";
import { getResourceUrl } from "../utils/resource";
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
        <p className="title-text">{t("common.resources")}</p>
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
              <span className="field-text name-text">{t("resources.name")}</span>
              <span className="field-text type-text">Type</span>
              <span></span>
            </div>
            {resources.length === 0 ? (
              <p className="tip-text">{t("resources.no-resources")}</p>
            ) : (
              resources.map((resource, index) => (
                <div key={resource.id} className="resource-container">
                  <span className="field-text name-text cursor-pointer" onClick={() => handlePreviewBtnClick(resource)}>
                    {resource.filename}
                  </span>
                  <span className="field-text type-text">{resource.type}</span>
                  <div className="flex justify-end">
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
            <Button onClick={handleConfirmBtnClick}>{t("common.confirm")}</Button>
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
      dialogName: "resources-selector-dialog",
    },
    ResourcesSelectorDialog,
    {}
  );
}
