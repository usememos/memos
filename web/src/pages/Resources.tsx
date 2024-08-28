import { Divider, IconButton, Input, Tooltip } from "@mui/joy";
import dayjs from "dayjs";
import { includes } from "lodash-es";
import { PaperclipIcon, SearchIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import Empty from "@/components/Empty";
import MobileHeader from "@/components/MobileHeader";
import ResourceIcon from "@/components/ResourceIcon";
import { resourceServiceClient } from "@/grpcweb";
import useLoading from "@/hooks/useLoading";
import i18n from "@/i18n";
import { useMemoStore } from "@/store/v1";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { useTranslate } from "@/utils/i18n";

function groupResourcesByDate(resources: Resource[]) {
  const grouped = new Map<string, Resource[]>();
  resources
    .sort((a, b) => dayjs(b.createTime).unix() - dayjs(a.createTime).unix())
    .forEach((item) => {
      const monthStr = dayjs(item.createTime).format("YYYY-MM");
      if (!grouped.has(monthStr)) {
        grouped.set(monthStr, []);
      }
      grouped.get(monthStr)?.push(item);
    });
  return grouped;
}

interface State {
  searchQuery: string;
}

const Resources = () => {
  const t = useTranslate();
  const loadingState = useLoading();
  const [state, setState] = useState<State>({
    searchQuery: "",
  });
  const memoStore = useMemoStore();
  const [resources, setResources] = useState<Resource[]>([]);
  const filteredResources = resources.filter((resource) => includes(resource.filename, state.searchQuery));
  const groupedResources = groupResourcesByDate(filteredResources.filter((resource) => resource.memo));
  const unusedResources = filteredResources.filter((resource) => !resource.memo);

  useEffect(() => {
    resourceServiceClient.listResources({}).then(({ resources }) => {
      setResources(resources);
      loadingState.setFinish();
      Promise.all(resources.map((resource) => (resource.memo ? memoStore.getOrFetchMemoByName(resource.memo) : null)));
    });
  }, []);

  const handleDeleteUnusedResources = async () => {
    const confirmed = window.confirm("Are you sure to delete all unused resources? This action cannot be undone.");
    if (confirmed) {
      for (const resource of unusedResources) {
        await resourceServiceClient.deleteResource({ name: resource.name });
      }
      setResources(resources.filter((resource) => resource.memo));
    }
  };

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="w-full px-4 sm:px-6">
        <div className="w-full shadow flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 text-black dark:text-gray-300">
          <div className="relative w-full flex flex-row justify-between items-center">
            <p className="py-1 flex flex-row justify-start items-center select-none opacity-80">
              <PaperclipIcon className="w-6 h-auto mr-1 opacity-80" />
              <span className="text-lg">{t("common.resources")}</span>
            </p>
            <div>
              <Input
                className="max-w-[8rem]"
                placeholder={t("common.search")}
                startDecorator={<SearchIcon className="w-4 h-auto" />}
                value={state.searchQuery}
                onChange={(e) => setState({ ...state, searchQuery: e.target.value })}
              />
            </div>
          </div>
          <div className="w-full flex flex-col justify-start items-start mt-4 mb-6">
            {loadingState.isLoading ? (
              <div className="w-full h-32 flex flex-col justify-center items-center">
                <p className="w-full text-center text-base my-6 mt-8">{t("resource.fetching-data")}</p>
              </div>
            ) : (
              <>
                {filteredResources.length === 0 ? (
                  <div className="w-full mt-8 mb-8 flex flex-col justify-center items-center italic">
                    <Empty />
                    <p className="mt-4 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
                  </div>
                ) : (
                  <div className={"w-full h-auto px-2 flex flex-col justify-start items-start gap-y-8"}>
                    {Array.from(groupedResources.entries()).map(([monthStr, resources]) => {
                      return (
                        <div key={monthStr} className="w-full flex flex-row justify-start items-start">
                          <div className="w-16 sm:w-24 pt-4 sm:pl-4 flex flex-col justify-start items-start">
                            <span className="text-sm opacity-60">{dayjs(monthStr).year()}</span>
                            <span className="font-medium text-xl">
                              {dayjs(monthStr).toDate().toLocaleString(i18n.language, { month: "short" })}
                            </span>
                          </div>
                          <div className="w-full max-w-[calc(100%-4rem)] sm:max-w-[calc(100%-6rem)] flex flex-row justify-start items-start gap-4 flex-wrap">
                            {resources.map((resource) => {
                              return (
                                <div key={resource.name} className="w-24 sm:w-32 h-auto flex flex-col justify-start items-start">
                                  <div className="w-24 h-24 flex justify-center items-center sm:w-32 sm:h-32 border dark:border-zinc-900 overflow-clip rounded-xl cursor-pointer hover:shadow hover:opacity-80">
                                    <ResourceIcon resource={resource} strokeWidth={0.5} />
                                  </div>
                                  <div className="w-full max-w-full flex flex-row justify-between items-center mt-1 px-1">
                                    <p className="text-xs shrink text-gray-400 truncate">{resource.filename}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {unusedResources.length > 0 && (
                      <>
                        <Divider />
                        <div className="w-full flex flex-row justify-start items-start">
                          <div className="w-16 sm:w-24 sm:pl-4 flex flex-col justify-start items-start"></div>
                          <div className="w-full max-w-[calc(100%-4rem)] sm:max-w-[calc(100%-6rem)] flex flex-row justify-start items-start gap-4 flex-wrap">
                            <div className="w-full flex flex-row justify-start items-center gap-2">
                              <span className="text-gray-600 dark:text-gray-400">Unused resources</span>
                              <span className="text-gray-500 dark:text-gray-500 opacity-80">({unusedResources.length})</span>
                              <Tooltip title="Delete all" placement="top">
                                <IconButton size="sm" onClick={handleDeleteUnusedResources}>
                                  <TrashIcon className="w-4 h-auto opacity-60" />
                                </IconButton>
                              </Tooltip>
                            </div>
                            {unusedResources.map((resource) => {
                              return (
                                <div key={resource.name} className="w-24 sm:w-32 h-auto flex flex-col justify-start items-start">
                                  <div className="w-24 h-24 flex justify-center items-center sm:w-32 sm:h-32 border dark:border-zinc-900 overflow-clip rounded-xl cursor-pointer hover:shadow hover:opacity-80">
                                    <ResourceIcon resource={resource} strokeWidth={0.5} />
                                  </div>
                                  <div className="w-full max-w-full flex flex-row justify-between items-center mt-1 px-1">
                                    <p className="text-xs shrink text-gray-400 truncate">{resource.filename}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Resources;
