import { useEffect } from "react";
import { toast } from "react-hot-toast";
import Empty from "@/components/Empty";
import Icon from "@/components/Icon";
import MobileHeader from "@/components/MobileHeader";
import ResourceCard from "@/components/ResourceCard";
import useLoading from "@/hooks/useLoading";
import { useResourceStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";

const Resources = () => {
  const t = useTranslate();
  const loadingState = useLoading();
  const resourceStore = useResourceStore();
  const resources = resourceStore.state.resources;

  useEffect(() => {
    resourceStore
      .fetchResourceList()
      .then(() => {
        loadingState.setFinish();
      })
      .catch((error) => {
        console.error(error);
        toast.error(error.response.data.message);
      });
  }, []);

  return (
    <section className="w-full max-w-3xl min-h-full flex flex-col justify-start items-center px-4 sm:px-2 sm:pt-4 pb-8 bg-zinc-100 dark:bg-zinc-800">
      <MobileHeader showSearch={false} />
      <div className="w-full flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-white dark:bg-zinc-700 text-black dark:text-gray-300">
        <div className="relative w-full flex flex-row justify-between items-center">
          <p className="px-2 py-1 flex flex-row justify-start items-center cursor-pointer select-none rounded opacity-80 hover:bg-gray-100 dark:hover:bg-zinc-700">
            <Icon.Paperclip className="w-5 h-auto mr-1" /> {t("common.resources")}
          </p>
        </div>
        <div className="w-full flex flex-col justify-start items-start mt-4 mb-6">
          {loadingState.isLoading ? (
            <div className="w-full h-32 flex flex-col justify-center items-center">
              <p className="w-full text-center text-base my-6 mt-8">{t("resource.fetching-data")}</p>
            </div>
          ) : (
            <div
              className={
                resources.length === 0
                  ? "flex flex-col justify-start items-start w-full"
                  : "w-full h-auto grid grid-cols-2 md:grid-cols-4 gap-6"
              }
            >
              {resources.length === 0 ? (
                <div className="w-full mt-8 mb-8 flex flex-col justify-center items-center italic">
                  <Empty />
                  <p className="mt-4 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
                </div>
              ) : (
                resources.map((resource) => <ResourceCard key={resource.id} resource={resource}></ResourceCard>)
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Resources;
