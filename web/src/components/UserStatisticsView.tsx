import { useEffect, useState } from "react";
import { memoServiceClient } from "@/grpcweb";
import { useMemoStore, useTagStore } from "@/store/v1";
import { User } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import Icon from "./Icon";

interface Props {
  user: User;
}

const UserStatisticsView = (props: Props) => {
  const { user } = props;
  const t = useTranslate();
  const tagStore = useTagStore();
  const memoStore = useMemoStore();
  const [memoAmount, setMemoAmount] = useState(0);
  const [isRequesting, setIsRequesting] = useState(false);
  const days = Math.ceil((Date.now() - user.createTime!.getTime()) / 86400000);
  const memos = Object.values(memoStore.getState().memoMapByName);
  const tags = tagStore.sortedTags().length;

  useEffect(() => {
    if (memos.length === 0) {
      return;
    }

    (async () => {
      setIsRequesting(true);
      const { stats } = await memoServiceClient.getUserMemosStats({
        name: user.name,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setIsRequesting(false);
      setMemoAmount(Object.values(stats).reduce((acc, cur) => acc + cur, 0));
    })();
  }, [memos.length, user.name]);

  return (
    <div className="w-full border mt-2 py-2 px-3 rounded-lg space-y-0.5 text-gray-500 dark:text-gray-400 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="mb-1 w-full flex flex-row justify-between items-center">
        <p className="text-sm font-medium leading-6 dark:text-gray-500">{t("common.statistics")}</p>
      </div>
      <div className="w-full flex justify-between items-center">
        <div className="w-full flex justify-start items-center">
          <Icon.CalendarDays className="w-4 h-auto mr-1" />
          <span className="block text-base sm:text-sm">{t("common.days")}</span>
        </div>
        <span className="font-mono">{days}</span>
      </div>
      <div className="w-full flex justify-between items-center">
        <div className="w-full flex justify-start items-center">
          <Icon.Library className="w-4 h-auto mr-1" />
          <span className="block text-base sm:text-sm">{t("common.memos")}</span>
        </div>
        {isRequesting ? <Icon.Loader className="animate-spin w-4 h-auto text-gray-400" /> : <span className="font-mono">{memoAmount}</span>}
      </div>
      <div className="w-full flex justify-between items-center">
        <div className="w-full flex justify-start items-center">
          <Icon.Tags className="w-4 h-auto mr-1" />
          <span className="block text-base sm:text-sm">{t("common.tags")}</span>
        </div>
        <span className="font-mono">{tags}</span>
      </div>
    </div>
  );
};

export default UserStatisticsView;
