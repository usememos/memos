import { useEffect, useState } from "react";
import { memoServiceClient } from "@/grpcweb";
import { useTagStore } from "@/store/module";
import { useMemoStore } from "@/store/v1";
import { User } from "@/types/proto/api/v2/user_service";
import Icon from "./Icon";

interface Props {
  user: User;
}

const PersonalStatistics = (props: Props) => {
  const { user } = props;
  const tagStore = useTagStore();
  const memoStore = useMemoStore();
  const [memoAmount, setMemoAmount] = useState(0);
  const [isRequesting, setIsRequesting] = useState(false);
  const days = Math.ceil((Date.now() - user.createTime!.getTime()) / 86400000);
  const memos = Object.values(memoStore.getState().memoMapById);
  const tags = tagStore.state.tags.length;

  useEffect(() => {
    if (memos.length === 0) {
      return;
    }

    (async () => {
      setIsRequesting(true);
      const { memoCreationStats } = await memoServiceClient.getUserMemosStats({
        name: user.name,
      });
      setIsRequesting(false);
      setMemoAmount(Object.values(memoCreationStats).reduce((acc, cur) => acc + cur, 0));
    })();
  }, [memos.length, user.name]);

  return (
    <div className="w-full border mt-2 py-2 px-3 rounded-md space-y-0.5 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800">
      <p className="text-sm font-medium text-gray-500">Statistics</p>
      <div className="w-full flex justify-between items-center">
        <div className="w-full flex justify-start items-center text-gray-500">
          <Icon.CalendarDays className="w-4 h-auto mr-1" />
          <span className="block text-base sm:text-sm">Days</span>
        </div>
        <span className="text-gray-500 font-mono">{days}</span>
      </div>
      <div className="w-full flex justify-between items-center">
        <div className="w-full flex justify-start items-center text-gray-500">
          <Icon.PencilLine className="w-4 h-auto mr-1" />
          <span className="block text-base sm:text-sm">Memos</span>
        </div>
        {isRequesting ? (
          <Icon.Loader className="animate-spin w-4 h-auto text-gray-400" />
        ) : (
          <span className="text-gray-500 font-mono">{memoAmount}</span>
        )}
      </div>
      <div className="w-full flex justify-between items-center">
        <div className="w-full flex justify-start items-center text-gray-500">
          <Icon.Hash className="w-4 h-auto mr-1" />
          <span className="block text-base sm:text-sm">Tags</span>
        </div>
        <span className="text-gray-500 font-mono">{tags}</span>
      </div>
    </div>
  );
};

export default PersonalStatistics;
