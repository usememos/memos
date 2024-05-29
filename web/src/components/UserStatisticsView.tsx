import { Divider, Tooltip } from "@mui/joy";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { memoServiceClient } from "@/grpcweb";
import { useFilterStore } from "@/store/module";
import { useMemoStore } from "@/store/v1";
import { User } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import { showCommonDialog } from "./Dialog/CommonDialog";
import Icon from "./Icon";

interface Props {
  user: User;
}

interface UserMemoStats {
  links: number;
  todos: number;
  code: number;
}

const UserStatisticsView = (props: Props) => {
  const { user } = props;
  const t = useTranslate();
  const memoStore = useMemoStore();
  const filterStore = useFilterStore();
  const [memoAmount, setMemoAmount] = useState(0);
  const [isRequesting, setIsRequesting] = useState(false);
  const [memoStats, setMemoStats] = useState<UserMemoStats>({ links: 0, todos: 0, code: 0 });
  const days = Math.ceil((Date.now() - user.createTime!.getTime()) / 86400000);
  const memos = Object.values(memoStore.getState().memoMapByName);

  useEffect(() => {
    (async () => {
      setIsRequesting(true);
      const { properties } = await memoServiceClient.listMemoProperties({
        name: `memos/-`,
      });
      const memoStats: UserMemoStats = { links: 0, todos: 0, code: 0 };
      properties.forEach((property) => {
        if (property.hasLink) {
          memoStats.links += 1;
        }
        if (property.hasTaskList) {
          memoStats.todos += 1;
        }
        if (property.hasCode) {
          memoStats.code += 1;
        }
      });
      setMemoStats(memoStats);
      setMemoAmount(properties.length);
      setIsRequesting(false);
    })();
  }, [memos.length, user.name]);

  const handleRebuildMemoTags = () => {
    showCommonDialog({
      title: "Refresh",
      content: "It will refersh memo properties, are you sure?",
      style: "warning",
      dialogName: "refersh-memo-property-dialog",
      onConfirm: async () => {
        await memoServiceClient.rebuildMemoProperty({
          name: "memos/-",
        });
        toast.success("Refresh successfully");
        window.location.reload();
      },
    });
  };

  return (
    <div className="w-full border mt-2 py-2 px-3 rounded-lg space-y-0.5 text-gray-500 dark:text-gray-400 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="group w-full flex flex-row justify-between items-center">
        <p className="text-sm font-medium leading-6 dark:text-gray-500">{t("common.statistics")}</p>
        <div className="hidden group-hover:block">
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
            className="w-auto border dark:border-zinc-800 pl-1 pr-1.5 rounded-md flex justify-between items-center cursor-pointer hover:opacity-80"
            onClick={() => filterStore.setMemoPropertyFilter({ hasLink: true })}
          >
            <div className="w-auto flex justify-start items-center mr-1">
              <Icon.Link className="w-4 h-auto mr-1" />
              <span className="block text-sm">{t("memo.links")}</span>
            </div>
            <span className="text-sm truncate">{memoStats.links}</span>
          </div>
          <div
            className="w-auto border dark:border-zinc-800 pl-1 pr-1.5 rounded-md flex justify-between items-center cursor-pointer hover:opacity-80"
            onClick={() => filterStore.setMemoPropertyFilter({ hasTaskList: true })}
          >
            <div className="w-auto flex justify-start items-center mr-1">
              <Icon.CheckCircle className="w-4 h-auto mr-1" />
              <span className="block text-sm">{t("memo.to-do")}</span>
            </div>
            <span className="text-sm truncate">{memoStats.todos}</span>
          </div>
          <div
            className="w-auto border dark:border-zinc-800 pl-1 pr-1.5 rounded-md flex justify-between items-center cursor-pointer hover:opacity-80"
            onClick={() => filterStore.setMemoPropertyFilter({ hasCode: true })}
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
