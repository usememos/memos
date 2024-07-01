import { Divider, Tooltip } from "@mui/joy";
import clsx from "clsx";
import { useState } from "react";
import toast from "react-hot-toast";
import { memoServiceClient } from "@/grpcweb";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useFilterStore } from "@/store/module";
import { useMemoStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";
import Icon from "./Icon";

interface UserMemoStats {
  link: number;
  taskList: number;
  code: number;
  incompleteTasks: number;
}

const UserStatisticsView = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const memoStore = useMemoStore();
  const filterStore = useFilterStore();
  const [memoAmount, setMemoAmount] = useState(0);
  const [isRequesting, setIsRequesting] = useState(false);
  const [memoStats, setMemoStats] = useState<UserMemoStats>({ link: 0, taskList: 0, code: 0, incompleteTasks: 0 });
  const days = Math.ceil((Date.now() - currentUser.createTime!.getTime()) / 86400000);
  const filter = filterStore.state;

  useAsyncEffect(async () => {
    setIsRequesting(true);
    const { properties } = await memoServiceClient.listMemoProperties({
      name: `memos/-`,
    });
    const memoStats: UserMemoStats = { link: 0, taskList: 0, code: 0, incompleteTasks: 0 };
    properties.forEach((property) => {
      if (property.hasLink) {
        memoStats.link += 1;
      }
      if (property.hasTaskList) {
        memoStats.taskList += 1;
      }
      if (property.hasCode) {
        memoStats.code += 1;
      }
      if (property.hasIncompleteTasks) {
        memoStats.incompleteTasks += 1;
      }
    });
    setMemoStats(memoStats);
    setMemoAmount(properties.length);
    setIsRequesting(false);
  }, [memoStore.stateId]);

  const handleRebuildMemoTags = async () => {
    await memoServiceClient.rebuildMemoProperty({
      name: "memos/-",
    });
    toast.success("Refresh successfully");
    window.location.reload();
  };

  return (
    <div className="group w-full border mt-2 py-2 px-3 rounded-lg space-y-0.5 text-gray-500 dark:text-gray-400 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="w-full mb-1 flex flex-row justify-between items-center">
        <p className="text-sm font-medium leading-6 dark:text-gray-500">{t("common.statistics")}</p>
        <div className="group-hover:block hidden">
          <Tooltip title={"Refresh"} placement="top">
            <Icon.RefreshCcw
              className="text-gray-400 w-4 h-auto cursor-pointer opacity-60 hover:opacity-100"
              onClick={handleRebuildMemoTags}
            />
          </Tooltip>
        </div>
      </div>
      <div className="w-full grid grid-cols-1 gap-x-4">
        <div className="w-full flex justify-between items-center">
          <div className="w-auto flex justify-start items-center">
            <Icon.CalendarDays className="w-4 h-auto mr-1" />
            <span className="block text-base sm:text-sm">Days</span>
          </div>
          <span>{days}</span>
        </div>
        <div className="w-full flex justify-between items-center">
          <div className="w-auto flex justify-start items-center">
            <Icon.Library className="w-4 h-auto mr-1" />
            <span className="block text-base sm:text-sm">Memos</span>
          </div>
          {isRequesting ? <Icon.Loader className="animate-spin w-4 h-auto text-gray-400" /> : <span className="">{memoAmount}</span>}
        </div>
        <Divider className="!my-1 opacity-50" />
        <div className="w-full mt-1 flex flex-row justify-start items-center gap-x-2 gap-y-1 flex-wrap">
          <div
            className={clsx(
              "w-auto border dark:border-zinc-800 pl-1 pr-1.5 rounded-md flex justify-between items-center cursor-pointer hover:shadow",
              filter.memoPropertyFilter?.hasLink ? "bg-blue-50 dark:bg-blue-900 shadow" : "",
            )}
            onClick={() => filterStore.setMemoPropertyFilter({ hasLink: !filter.memoPropertyFilter?.hasLink })}
          >
            <div className="w-auto flex justify-start items-center mr-1">
              <Icon.Link className="w-4 h-auto mr-1" />
              <span className="block text-sm">{t("memo.links")}</span>
            </div>
            <span className="text-sm truncate">{memoStats.link}</span>
          </div>
          <div
            className={clsx(
              "w-auto border dark:border-zinc-800 pl-1 pr-1.5 rounded-md flex justify-between items-center cursor-pointer hover:shadow",
              filter.memoPropertyFilter?.hasTaskList ? "bg-blue-50 dark:bg-blue-900 shadow" : "",
            )}
            onClick={() => filterStore.setMemoPropertyFilter({ hasTaskList: !filter.memoPropertyFilter?.hasTaskList })}
          >
            <div className="w-auto flex justify-start items-center mr-1">
              {memoStats.incompleteTasks > 0 ? (
                <Icon.ListTodo className="w-4 h-auto mr-1" />
              ) : (
                <Icon.CheckCircle className="w-4 h-auto mr-1" />
              )}
              <span className="block text-sm">{t("memo.to-do")}</span>
            </div>
            {memoStats.incompleteTasks > 0 ? (
              <Tooltip title={"Done / Total"} placement="top" arrow>
                <div className="text-sm flex flex-row items-start justify-center">
                  <span className="truncate">{memoStats.taskList - memoStats.incompleteTasks}</span>
                  <span className="font-mono opacity-50">/</span>
                  <span className="truncate">{memoStats.taskList}</span>
                </div>
              </Tooltip>
            ) : (
              <span className="text-sm truncate">{memoStats.taskList}</span>
            )}
          </div>
          <div
            className={clsx(
              "w-auto border dark:border-zinc-800 pl-1 pr-1.5 rounded-md flex justify-between items-center cursor-pointer hover:shadow",
              filter.memoPropertyFilter?.hasCode ? "bg-blue-50 dark:bg-blue-900 shadow" : "",
            )}
            onClick={() => filterStore.setMemoPropertyFilter({ hasCode: !filter.memoPropertyFilter?.hasCode })}
          >
            <div className="w-auto flex justify-start items-center mr-1">
              <Icon.Code2 className="w-4 h-auto mr-1" />
              <span className="block text-sm">{t("memo.code")}</span>
            </div>
            <span className="text-sm truncate">{memoStats.code}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserStatisticsView;
