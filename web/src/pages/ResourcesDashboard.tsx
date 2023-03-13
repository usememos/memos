import { Button } from "@mui/joy";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import useLoading from "../hooks/useLoading";
import { useResourceStore } from "../store/module";
import Icon from "../components/Icon";
import { remove } from "lodash-es";
import FileCard from "../components/FileCard";

import { showCommonDialog } from "../components/Dialog/CommonDialog";
import showCreateResourceDialog from "../components/CreateResourceDialog";
import MobileHeader from "../components/MobileHeader";

const ResourcesDashboard = () => {
  const { t } = useTranslation();
  const loadingState = useLoading();
  const resourceStore = useResourceStore();
  const resources = resourceStore.state.resources;
  const [selectList, setSelectList] = useState<Array<Resource>>([]);

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

  const handleSelectBtnClick = (resource: Resource) => {
    // first click and second click?
    setSelectList([...selectList, resource]);
  };

  const handleUnSelectBtnClick = (resource: Resource) => {
    // first click and second click?
    setSelectList(
      remove(selectList, (res) => {
        res == resource;
      })
    );
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

  // const handleUnSelectBtnClick = () => {
  //   setSelectList([]);
  // };

  const handleDeleteSelectedBtnClick = () => {
    const warningText = t("resources.warning-text");

    showCommonDialog({
      title: t("resources.delete-resource"),
      content: warningText,
      style: "warning",
      dialogName: "delete-resource-dialog",
      onConfirm: async () => {
        selectList.map(async (resource: Resource) => {
          await resourceStore.deleteResourceById(resource.id);
        });
      },
    });
  };

  return (
    <section className="w-full min-h-full flex flex-col justify-start items-center px-4 sm:px-2 sm:pt-4 pb-8 bg-zinc-100 dark:bg-zinc-800">
      <MobileHeader showSearch={false} />
      <div className="w-full flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-white dark:bg-zinc-700 text-black dark:text-gray-300">
        <div className="relative w-full flex flex-row justify-between items-center">
          <p className="px-2 py-1 flex flex-row justify-start items-center cursor-pointer select-none rounded hover:bg-gray-100 dark:hover:bg-zinc-700">
            <Icon.Paperclip className="w-5 h-auto mr-1" /> {t("common.resources")}
          </p>
        </div>

        <div className=" flex flex-col justify-start items-start w-full">
          <div className="w-full flex flex-row justify-between items-center">
            <div className="flex flex-row justify-start items-center space-x-2">
              <Button onClick={() => showCreateResourceDialog({})} startDecorator={<Icon.Plus className="w-5 h-auto" />}>
                {t("common.create")}
              </Button>

              <Button onClick={() => handleDeleteSelectedBtnClick()} color="danger" startDecorator={<Icon.Trash2 className="w-4 h-auto" />}>
                {t("resources.delete-selected-resources")}
              </Button>
            </div>
            <div className="flex flex-row justify-end items-center">
              <Button color="danger" onClick={handleDeleteUnusedResourcesBtnClick} startDecorator={<Icon.Trash2 className="w-4 h-auto" />}>
                <span>{t("resources.clear")}</span>
              </Button>
            </div>
          </div>
          {loadingState.isLoading ? (
            <div className="flex flex-col justify-center items-center w-full h-32">
              <p className="w-full text-center text-base my-6 mt-8">{t("resources.fetching-data")}</p>
            </div>
          ) : (
            <div className="flex  w-full h-full flex-wrap justify-start">
              {resources.length === 0 ? (
                <p className="w-full text-center text-base my-6 mt-8">{t("resources.no-resources")}</p>
              ) : (
                resources.map((resource) => (
                  <FileCard
                    key={resource.id}
                    resource={resource}
                    select={() => handleSelectBtnClick(resource)}
                    unselect={() => handleUnSelectBtnClick(resource)}
                  ></FileCard>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ResourcesDashboard;
