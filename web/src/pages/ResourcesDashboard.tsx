import { Button } from "@mui/joy";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import showCreateResourceDialog from "@/components/CreateResourceDialog";
import { showCommonDialog } from "@/components/Dialog/CommonDialog";
import Empty from "@/components/Empty";
import Icon from "@/components/Icon";
import Dropdown from "@/components/kit/Dropdown";
import MobileHeader from "@/components/MobileHeader";
import ResourceCard from "@/components/ResourceCard";
import ResourceItem from "@/components/ResourceItem";
import ResourceSearchBar from "@/components/ResourceSearchBar";
import { DEFAULT_MEMO_LIMIT } from "@/helpers/consts";
import useEvent from "@/hooks/useEvent";
import useLoading from "@/hooks/useLoading";
import { useResourceStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";

const ResourcesDashboard = () => {
  const t = useTranslate();
  const loadingState = useLoading();
  const resourceStore = useResourceStore();
  const resources = resourceStore.state.resources;
  const [selectedList, setSelectedList] = useState<Array<ResourceId>>([]);
  const [listStyle, setListStyle] = useState<"GRID" | "TABLE">("TABLE");
  const [queryText, setQueryText] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);

  useEffect(() => {
    resourceStore
      .fetchResourceListWithLimit(DEFAULT_MEMO_LIMIT)
      .then((fetchedResource) => {
        if (fetchedResource.length < DEFAULT_MEMO_LIMIT) {
          setIsComplete(true);
        }
        loadingState.setFinish();
      })
      .catch((error) => {
        console.error(error);
        toast.error(error.response.data.message);
      });
  }, []);

  const handleCheckBtnClick = useEvent((resourceId: ResourceId) => {
    setSelectedList([...selectedList, resourceId]);
  });

  const handleUncheckBtnClick = useEvent((resourceId: ResourceId) => {
    setSelectedList(selectedList.filter((id) => id !== resourceId));
  });

  const handleStyleChangeBtnClick = (listStyle: "GRID" | "TABLE") => {
    setListStyle(listStyle);
    setSelectedList([]);
  };

  const handleDeleteUnusedResourcesBtnClick = async () => {
    let warningText = t("resource.warning-text-unused");
    const allResources = await fetchAllResources();
    const unusedResources = allResources.filter((resource) => {
      if (resource.linkedMemoAmount === 0) {
        warningText = warningText + `\n- ${resource.filename}`;
        return true;
      }
      return false;
    });
    if (unusedResources.length === 0) {
      toast.success(t("resource.no-unused-resources"));
      return;
    }

    showCommonDialog({
      title: t("resource.delete-resource"),
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
      toast.error(t("resource.no-files-selected"));
    } else {
      const warningText = t("resource.warning-text");
      showCommonDialog({
        title: t("resource.delete-resource"),
        content: warningText,
        style: "warning",
        dialogName: "delete-resource-dialog",
        onConfirm: async () => {
          for (const resourceId of selectedList) {
            await resourceStore.deleteResourceById(resourceId);
          }

          setSelectedList([]);
        },
      });
    }
  };

  const handleFetchMoreResourceBtnClick = async () => {
    try {
      const fetchedResource = await resourceStore.fetchResourceListWithLimit(DEFAULT_MEMO_LIMIT, resources.length);
      if (fetchedResource.length < DEFAULT_MEMO_LIMIT) {
        setIsComplete(true);
      } else {
        setIsComplete(false);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
    }
  };

  const fetchAllResources = async () => {
    if (isComplete) {
      return resources;
    }

    loadingState.setLoading();
    try {
      const allResources = await resourceStore.fetchResourceList();
      loadingState.setFinish();
      setIsComplete(true);
      return allResources;
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
      return resources;
    }
  };

  const handleSearchResourceInputChange = async (query: string) => {
    // to prevent first tiger when page is loaded
    if (query === queryText) return;
    await fetchAllResources();
    setQueryText(query);
    setSelectedList([]);
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const resourceList = useMemo(
    () =>
      resources
        .filter((res: Resource) => (queryText === "" ? true : res.filename.toLowerCase().includes(queryText.toLowerCase())))
        .map((resource) =>
          listStyle === "TABLE" ? (
            <ResourceItem
              key={resource.id}
              resource={resource}
              handleCheckClick={() => handleCheckBtnClick(resource.id)}
              handleUncheckClick={() => handleUncheckBtnClick(resource.id)}
            ></ResourceItem>
          ) : (
            <ResourceCard
              key={resource.id}
              resource={resource}
              handleCheckClick={() => handleCheckBtnClick(resource.id)}
              handleUncheckClick={() => handleUncheckBtnClick(resource.id)}
            ></ResourceCard>
          )
        ),
    [resources, queryText, listStyle]
  );

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await resourceStore.createResourcesWithBlob(e.dataTransfer.files).then(
        (res) => {
          for (const resource of res) {
            toast.success(`${resource.filename} ${t("resource.upload-successfully")}`);
          }
        },
        (reason) => {
          toast.error(reason);
        }
      );
    }
  };

  return (
    <section className="w-full max-w-3xl min-h-full flex flex-col justify-start items-center px-4 sm:px-2 sm:pt-4 pb-8 bg-zinc-100 dark:bg-zinc-800">
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
              <p className="m-auto text-2xl text-white dark:text-black">{t("resource.file-drag-drop-prompt")}</p>
            </div>
          </div>
        )}

        <div className="w-full flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-white dark:bg-zinc-700 text-black dark:text-gray-300">
          <div className="relative w-full flex flex-row justify-between items-center">
            <p className="flex flex-row justify-start items-center select-none rounded">
              <Icon.Paperclip className="w-5 h-auto mr-1 ml-2" /> {t("common.resources")}
            </p>
            <ResourceSearchBar setQuery={handleSearchResourceInputChange} />
          </div>
          <div className="w-full flex flex-row justify-end items-center space-x-2 mt-3 z-1">
            {selectedList.length > 0 && (
              <Button onClick={() => handleDeleteSelectedBtnClick()} color="danger">
                <Icon.Trash2 className="w-4 h-auto" />
              </Button>
            )}
            <Button
              onClick={() =>
                showCreateResourceDialog({
                  onConfirm: () => {
                    resourceStore.fetchResourceList();
                  },
                })
              }
            >
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
                    {t("resource.clear")}
                  </button>
                </>
              }
            />
            <div className="flex rounded-lg cursor-pointer h-8 overflow-clip border dark:border-zinc-600">
              <div
                className={`flex justify-center items-center px-3 ${
                  listStyle === "GRID" ? "bg-white dark:bg-zinc-700" : "bg-gray-200 dark:bg-zinc-800 opacity-60"
                }`}
                onClick={() => handleStyleChangeBtnClick("GRID")}
              >
                <Icon.Grid className="w-4 h-auto opacity-80" />
              </div>
              <div
                className={`flex justify-center items-center px-3 ${
                  listStyle === "TABLE" ? "bg-white dark:bg-zinc-700" : "bg-gray-200 dark:bg-zinc-800 opacity-60"
                }`}
                onClick={() => handleStyleChangeBtnClick("TABLE")}
              >
                <Icon.List className="w-4 h-auto opacity-80" />
              </div>
            </div>
          </div>
          <div className="w-full flex flex-col justify-start items-start mt-4 mb-6">
            {loadingState.isLoading ? (
              <div className="w-full h-32 flex flex-col justify-center items-center">
                <p className="w-full text-center text-base my-6 mt-8">{t("resource.fetching-data")}</p>
              </div>
            ) : (
              <div
                className={
                  listStyle === "TABLE" || resourceList.length === 0
                    ? "flex flex-col justify-start items-start w-full"
                    : "w-full h-auto grid grid-cols-2 md:grid-cols-4 md:px-6 gap-6"
                }
              >
                {listStyle === "TABLE" && (
                  <div className="px-2 py-2 w-full grid grid-cols-10 border-b dark:border-b-zinc-600">
                    <span></span>
                    <span className="col-span-2">ID</span>
                    <span className="col-span-6">{t("common.name")}</span>
                    <span></span>
                  </div>
                )}
                {resourceList.length === 0 ? (
                  <div className="w-full mt-8 mb-8 flex flex-col justify-center items-center italic">
                    <Empty />
                    <p className="mt-4 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
                  </div>
                ) : (
                  resourceList
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col justify-start items-center w-full">
            <p className="text-sm text-gray-400 italic">
              {!isComplete && (
                <span className="cursor-pointer my-6 hover:text-green-600" onClick={handleFetchMoreResourceBtnClick}>
                  {t("memo.fetch-more")}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ResourcesDashboard;
