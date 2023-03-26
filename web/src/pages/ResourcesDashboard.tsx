import { Button } from "@mui/joy";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import useLoading from "../hooks/useLoading";
import { useResourceStore } from "../store/module";
import Icon from "../components/Icon";
import ResourceCard from "../components/ResourceCard";
import ResourceSearchBar from "../components/ResourceSearchBar";
import MobileHeader from "../components/MobileHeader";
import Dropdown from "../components/base/Dropdown";
import ResourceItem from "../components/ResourceItem";
import { showCommonDialog } from "../components/Dialog/CommonDialog";
import showChangeResourceFilenameDialog from "../components/ChangeResourceFilenameDialog";
import copy from "copy-to-clipboard";
import { getResourceUrl } from "../utils/resource";
import showPreviewImageDialog from "../components/PreviewImageDialog";
import showCreateResourceDialog from "../components/CreateResourceDialog";
import useListStyle from "../hooks/useListStyle";

const ResourcesDashboard = () => {
  const { t } = useTranslation();
  const loadingState = useLoading();
  const resourceStore = useResourceStore();
  const resources = resourceStore.state.resources;
  const [selectedList, setSelectedList] = useState<Array<ResourceId>>([]);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [queryText, setQueryText] = useState<string>("");
  const { listStyle, setToTableStyle, setToGridStyle } = useListStyle();
  const [dragActive, setDragActive] = useState(false);

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
      setIsVisible(false);
    } else {
      setIsVisible(true);
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

  const handleStyleChangeBtnClick = (listStyleValue: boolean) => {
    if (listStyleValue) {
      setToTableStyle();
    } else {
      setToGridStyle();
    }
    setSelectedList([]);
  };

  const handleRenameBtnClick = (resource: Resource) => {
    showChangeResourceFilenameDialog(resource.id, resource.filename);
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
      dialogName: "delete-resource-dialog",
      onConfirm: async () => {
        await resourceStore.deleteResourceById(resource.id);
      },
    });
  };

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

  const handleCopyResourceLinkBtnClick = (resource: Resource) => {
    const url = getResourceUrl(resource);
    copy(url);
    toast.success(t("message.succeed-copy-resource-link"));
  };

  const resourceList = useMemo(
    () =>
      resources
        .filter((res: Resource) => (queryText === "" ? true : res.filename.toLowerCase().includes(queryText.toLowerCase())))
        .map((resource) =>
          listStyle ? (
            <ResourceItem
              key={resource.id}
              resource={resource}
              handleCheckClick={() => handleCheckBtnClick(resource.id)}
              handleUncheckClick={() => handleUncheckBtnClick(resource.id)}
              handleRenameBtnClick={handleRenameBtnClick}
              handleDeleteResourceBtnClick={handleDeleteResourceBtnClick}
              handlePreviewBtnClick={handlePreviewBtnClick}
              handleCopyResourceLinkBtnClick={handleCopyResourceLinkBtnClick}
            ></ResourceItem>
          ) : (
            <ResourceCard
              key={resource.id}
              resource={resource}
              handleCheckClick={() => handleCheckBtnClick(resource.id)}
              handleUncheckClick={() => handleUncheckBtnClick(resource.id)}
              handleRenameBtnClick={handleRenameBtnClick}
              handleDeleteResourceBtnClick={handleDeleteResourceBtnClick}
              handlePreviewBtnClick={handlePreviewBtnClick}
              handleCopyResourceLinkBtnClick={handleCopyResourceLinkBtnClick}
            ></ResourceCard>
          )
        ),
    [resources, queryText, listStyle]
  );

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await resourceStore.createResourcesWithBlob(e.dataTransfer.files).then(
        (res) => {
          for (const resource of res) {
            toast.success(`${resource.filename} ${t("resources.upload-successfully")}`);
          }
        },
        (reason) => {
          toast.error(reason);
        }
      );
    }
  };

  return (
    <section className="w-full max-w-2xl min-h-full flex flex-col justify-start items-center px-4 sm:px-2 sm:pt-4 pb-8 bg-zinc-100 dark:bg-zinc-800">
      <MobileHeader showSearch={false} />
      <div className="w-full relative" onDragEnter={handleDrag}>
        {dragActive && (
          <div
            className="absolute h-full w-full rounded-xl bg-zinc-800 dark:bg-white opacity-60 z-10"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex h-full w-full">
              <p className="m-auto text-2xl text-white dark:text-black">{t("resources.file-drag-drop-prompt")}</p>
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
            {isVisible && (
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
            <div className="flex rounded-lg cursor-pointer h-8 overflow-clip border dark:border-zinc-600">
              <div
                className={`flex justify-center items-center px-3 ${
                  !listStyle ? "bg-white dark:bg-zinc-700" : "bg-gray-200 dark:bg-zinc-800 opacity-60"
                }`}
                onClick={() => handleStyleChangeBtnClick(false)}
              >
                <Icon.Grid className="w-4 h-auto opacity-80" />
              </div>
              <div
                className={`flex justify-center items-center px-3 ${
                  listStyle ? "bg-white dark:bg-zinc-700" : "bg-gray-200 dark:bg-zinc-800 opacity-60"
                }`}
                onClick={() => handleStyleChangeBtnClick(true)}
              >
                <Icon.List className="w-4 h-auto opacity-80" />
              </div>
            </div>
          </div>
          <div className="w-full flex flex-col justify-start items-start mt-4 mb-6">
            {loadingState.isLoading ? (
              <div className="w-full h-32 flex flex-col justify-center items-center">
                <p className="w-full text-center text-base my-6 mt-8">{t("resources.fetching-data")}</p>
              </div>
            ) : (
              <div
                className={
                  listStyle
                    ? "flex flex-col justify-start items-start w-full"
                    : "w-full h-auto grid grid-cols-2 md:grid-cols-4 md:px-6 gap-6"
                }
              >
                {listStyle && (
                  <div className="px-2 py-2 w-full grid grid-cols-7 border-b dark:border-b-zinc-600">
                    <span>{t("resources.select")}</span>
                    <span className="field-text id-text">ID</span>
                    <span className="field-text name-text">{t("resources.name")}</span>
                    <span></span>
                  </div>
                )}
                {resources.length === 0 ? (
                  <p className="w-full text-center text-base my-6 mt-8">{t("resources.no-resources")}</p>
                ) : (
                  resourceList
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
