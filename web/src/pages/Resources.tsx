import axios from "axios";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Empty from "@/components/Empty";
import Icon from "@/components/Icon";
import MobileHeader from "@/components/MobileHeader";
import ResourceIcon from "@/components/ResourceIcon";
import useLoading from "@/hooks/useLoading";
import { ListResourcesResponse, Resource } from "@/types/proto/api/v2/resource_service_pb";
import { useTranslate } from "@/utils/i18n";

const fetchAllResources = async () => {
  const { data } = await axios.get<ListResourcesResponse>("/api/v2/resources");
  return data.resources;
};

function groupResourcesByDate(resources: Resource[]) {
  const grouped = new Map<number, Resource[]>();
  resources.forEach((item) => {
    const date = new Date(item.createdTs as any);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const timestamp = Date.UTC(year, month - 1, 1);
    if (!grouped.has(timestamp)) {
      grouped.set(timestamp, []);
    }
    grouped.get(timestamp)?.push(item);
  });
  return grouped;
}

const Resources = () => {
  const t = useTranslate();
  const loadingState = useLoading();
  const [resources, setResources] = useState<Resource[]>([]);
  const groupedResources = groupResourcesByDate(resources);

  useEffect(() => {
    fetchAllResources().then((resources) => {
      setResources(resources);
      loadingState.setFinish();
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
            <>
              {resources.length === 0 ? (
                <div className="w-full mt-8 mb-8 flex flex-col justify-center items-center italic">
                  <Empty />
                  <p className="mt-4 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
                </div>
              ) : (
                <div className={"w-full h-auto px-2 flex flex-col justify-start items-start gap-y-8"}>
                  {Array.from(groupedResources.entries()).map(([timestamp, resources]) => {
                    const date = new Date(timestamp);
                    return (
                      <div key={timestamp} className="w-full flex flex-row justify-start items-start">
                        <div className="w-16 sm:w-24 pt-4 sm:pl-4 flex flex-col justify-start items-start">
                          <span className="text-sm opacity-60">{date.getFullYear()}</span>
                          <span className="font-medium text-xl">{date.toLocaleString("default", { month: "short" })}</span>
                        </div>
                        <div className="w-full max-w-[calc(100%-4rem)] sm:max-w-[calc(100%-6rem)] flex flex-row justify-start items-start gap-4 flex-wrap">
                          {resources.map((resource) => {
                            return (
                              <div key={resource.id} className="w-auto h-auto flex flex-col justify-start items-start">
                                <div className="w-24 h-24 flex justify-center items-center sm:w-32 sm:h-32 border dark:border-zinc-900 overflow-clip rounded cursor-pointer hover:shadow hover:opacity-80">
                                  <ResourceIcon resource={resource} strokeWidth={0.5} />
                                </div>
                                <div className="w-full flex flex-row justify-between items-center mt-1 px-1">
                                  <div>
                                    <p className="text-xs text-gray-400">{resource.type}</p>
                                  </div>
                                  <Link
                                    className="flex flex-row justify-start items-center text-gray-400 hover:underline hover:text-blue-600"
                                    to={`/m/${resource.relatedMemoId}`}
                                    target="_blank"
                                  >
                                    <span className="text-xs ml-0.5">#{resource.relatedMemoId}</span>
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default Resources;
