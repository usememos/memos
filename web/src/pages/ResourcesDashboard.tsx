import { Button } from "@mui/joy";
import { useEffect, useState, useRef } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import useLoading from "../hooks/useLoading";
import { useResourceStore } from "../store/module";
import Icon from "../components/Icon";
import ResourceCard from "../components/ResourceCard";
import ResourceSearchBar from "../components/ResourceSearchBar";
import { showCommonDialog } from "../components/Dialog/CommonDialog";
import showCreateResourceDialog from "../components/CreateResourceDialog";
import MobileHeader from "../components/MobileHeader";
import Dropdown from "../components/base/Dropdown";

const ResourcesDashboard = () => {
  const { t } = useTranslation();
  const loadingState = useLoading();
  const resourceStore = useResourceStore();
  const resources = resourceStore.state.resources;
  const [selectedList, setSelectedList] = useState<Array<ResourceId>>([]);
  const [isVisiable, setIsVisiable] = useState<boolean>(false);
  const [queryText, setQueryText] = useState<string>("");

  const [dragActive, setDragActive] = useState(false);
  // ref
  const inputRef = useRef(null);

  useEffect(() => {
    resourceStore
      .fetchResourceList()
      .catch((error) => {
        console.error(error);
        toast.error(error.response.data.message);
      })
      .finally(() => {
        loadingState.setFinish();
      });
  }, []);

  useEffect(() => {
    if (selectedList.length === 0) {
      setIsVisiable(false);
    } else {
      setIsVisiable(true);
    }
  }, [selectedList]);

  const handleCheckBtnClick = (resourceId: ResourceId) => {
    setSelectedList([...selectedList, resourceId]);
  };

  const handleUncheckBtnClick = (resourceId: ResourceId) => {
    setSelectedList(selectedList.filter((resId) => resId !== resourceId));
  };

  const handleDeleteUnusedResourcesBtnClick = () => {
    let warningText = t("resources.warning-text-unused");
    const unusedResources = resources.filter((resource) => {
      if (resource.linkedMemoAmount === 0) {
        warningText = warningText + `\n- ${resource.filename}`;
        return true;
      }
      return false;
    });
    if (unusedResources.length === 0) {
      toast.success(t("resources.no-unused-resources"));
      return;
    }
    showCommonDialog({
      title: t("resources.delete-resource"),
      content: warningText,
      style: "warning",
      dialogName: "delete-unused-resources",
      onConfirm: async () => {
        for (const resource of unusedResources) {
          await resourceStore.deleteResourceById(resource.id);
        }
      },
    });
  };

  const handleDeleteSelectedBtnClick = () => {
    if (selectedList.length == 0) {
      toast.error(t("resources.no-files-selected"));
    } else {
      const warningText = t("resources.warning-text");
      showCommonDialog({
        title: t("resources.delete-resource"),
        content: warningText,
        style: "warning",
        dialogName: "delete-resource-dialog",
        onConfirm: async () => {
          selectedList.map(async (resourceId: ResourceId) => {
            await resourceStore.deleteResourceById(resourceId);
          });
        },
      });
    }
  };

  const handleDrag = function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // triggers when file is dropped
  const handleDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // handleFiles(e.dataTransfer.files);
      console.log(e.dataTransfer.files);
    }
  };

  // triggers when file is selected with click
  const handleChange = function (e) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      // handleFiles(e.target.files);
    }
  };

  // triggers the input when the button is clicked
  const onButtonClick = () => {
    inputRef.current.click();
  };

  return (
    <section className="w-full max-w-2xl min-h-full flex flex-col justify-start items-center px-4 sm:px-2 sm:pt-4 pb-8 bg-zinc-100 dark:bg-zinc-800">
      <MobileHeader showSearch={false} />
      <div className="relative" onDragEnter={handleDrag}>
        <input ref={inputRef} type="file" className="hidden" multiple={true} onChange={handleChange} />
        <div></div>
        {dragActive && (
          <div
            className="absolute h-full w-full bg-white opacity-40 "
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex h-full w-full">
              <div className="m-auto">Drag and drop your file here to upload file</div>
            </div>
          </div>
        )}

        <div className="w-full flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-white dark:bg-zinc-700 text-black dark:text-gray-300">
          <div className="relative w-full flex flex-row justify-between items-center">
            <p className="flex flex-row justify-start items-center select-none rounded">
              <Icon.Paperclip className="w-5 h-auto mr-1" /> {t("common.resources")}
            </p>
            <ResourceSearchBar setQuery={setQueryText} />
          </div>
          <div className="w-full flex flex-row justify-end items-center space-x-2 mt-3 z-1">
            {isVisiable && (
              <Button onClick={() => handleDeleteSelectedBtnClick()} color="danger">
                <Icon.Trash2 className="w-4 h-auto" />
              </Button>
            )}
            <Button onClick={() => showCreateResourceDialog({})}>
              <Icon.Plus className="w-4 h-auto" />
            </Button>
            <Dropdown
              className="drop-shadow-none"
              actionsClassName="!w-28 rounded-lg drop-shadow-md	dark:bg-zinc-800"
              positionClassName="mt-2 top-full right-0"
              trigger={
                <Button variant="outlined">
                  <Icon.MoreVertical className="w-4 h-auto" />
                </Button>
              }
              actions={
                <>
                  <button
                    className="w-full flex flex-row justify-start items-center content-center text-sm whitespace-nowrap leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-zinc-600"
                    onClick={handleDeleteUnusedResourcesBtnClick}
                  >
                    <Icon.Trash2 className="w-4 h-auto mr-2" />
                    {t("resources.clear")}
                  </button>
                </>
              }
            />
          </div>
          <div className="w-full flex flex-col justify-start items-start mt-4 mb-6">
            {ondrag ? (
              <div className="w-full h-32 flex flex-col justify-center items-center">drop to upload</div>
            ) : loadingState.isLoading ? (
              <div className="w-full h-32 flex flex-col justify-center items-center">
                <p className="w-full text-center text-base my-6 mt-8">{t("resources.fetching-data")}</p>
              </div>
            ) : (
              <div className="w-full h-auto grid grid-cols-2 md:grid-cols-4 md:px-6 gap-6">
                {resources.length === 0 ? (
                  <p className="w-full text-center text-base my-6 mt-8">{t("resources.no-resources")}</p>
                ) : (
                  resources
                    .filter((res: Resource) => (queryText === "" ? true : res.filename.toLowerCase().includes(queryText.toLowerCase())))
                    .map((resource) => (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        handlecheckClick={() => handleCheckBtnClick(resource.id)}
                        handleUncheckClick={() => handleUncheckBtnClick(resource.id)}
                      ></ResourceCard>
                    ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ResourcesDashboard;
