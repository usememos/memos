import { useEffect, useState } from "react";
import { memoServiceClient } from "@/grpcweb";
import { useMemoStore, useTagStore } from "@/store/v1";
import { User } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
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
  const tagStore = useTagStore();
  const [memoAmount, setMemoAmount] = useState(0);
  const [isRequesting, setIsRequesting] = useState(false);
  const [memoStats, setMemoStats] = useState<UserMemoStats>({ links: 0, todos: 0, code: 0 });
  const days = Math.ceil((Date.now() - user.createTime!.getTime()) / 86400000);
  const memos = Object.values(memoStore.getState().memoMapByName);
  const tags = tagStore.sortedTags().length;

  useEffect(() => {
    if (memos.length === 0) {
      return;
    }

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

  return (
    <div className="w-full border mt-2 py-2 px-3 rounded-lg space-y-0.5 text-gray-500 dark:text-gray-400 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="w-full flex flex-row justify-between items-center">
        <p className="text-sm font-medium leading-6 dark:text-gray-500">{t("common.statistics")}</p>
      </div>
      <div className="w-full grid grid-cols-2 gap-x-4">
        <div className="w-full flex justify-between items-center">
          <div className="w-auto flex justify-start items-center">
            <Icon.CalendarDays className="w-4 h-auto mr-1" />
            <span className="block text-base sm:text-sm">{t("common.days")}</span>
          </div>
          <span>{days}</span>
        </div>
        <div className="w-full flex justify-between items-center">
          <div className="w-auto flex justify-start items-center">
            <Icon.Library className="w-4 h-auto mr-1" />
            <span className="block text-base sm:text-sm">{t("common.memos")}</span>
          </div>
          {isRequesting ? <Icon.Loader className="animate-spin w-4 h-auto text-gray-400" /> : <span className="">{memoAmount}</span>}
        </div>
        <div className="w-full flex justify-between items-center">
          <div className="w-auto flex justify-start items-center">
            <Icon.Hash className="w-4 h-auto mr-1" />
            <span className="block text-base sm:text-sm">{t("common.tags")}</span>
          </div>
          <span>{tags}</span>
        </div>
        <div className="w-full flex justify-between items-center">
          <div className="w-auto flex justify-start items-center">
            <Icon.Link className="w-4 h-auto mr-1" />
            <span className="block text-base sm:text-sm">Links</span>
          </div>
          <span className="">{memoStats.links}</span>
        </div>
        <div className="w-full flex justify-between items-center">
          <div className="w-auto flex justify-start items-center">
            <Icon.CheckCircle className="w-4 h-auto mr-1" />
            <span className="block text-base sm:text-sm">Todos</span>
          </div>
          <span className="">{memoStats.todos}</span>
        </div>
        <div className="w-full flex justify-between items-center">
          <div className="w-auto flex justify-start items-center">
            <Icon.Code2 className="w-4 h-auto mr-1" />
            <span className="block text-base sm:text-sm">Code</span>
          </div>
          <span className="">{memoStats.code}</span>
        </div>
      </div>
    </div>
  );
};

export default UserStatisticsView;
