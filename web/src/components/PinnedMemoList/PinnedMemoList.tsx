import { LoaderIcon } from "lucide-react";
import { useEffect, useState } from "react";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoStore, usePinnedMemoList } from "@/store/v1";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import Empty from "../Empty";

interface Props {
  renderer: (memo: Memo) => JSX.Element;
  listSort?: (list: Memo[]) => Memo[];
}

interface State {
  isRequesting: boolean;
}

const PinnedMemoList = (props: Props) => {
  const t = useTranslate();
  const user = useCurrentUser();
  const memoStore = useMemoStore();
  const pinnedMemoList = usePinnedMemoList();
  const [state, setState] = useState<State>({
    isRequesting: true, // Initial request
  });
  const sortedMemoList = props.listSort ? props.listSort(pinnedMemoList) : pinnedMemoList;

  const fetchPinnedMemos = async () => {
    if (!user) return;

    setState({ isRequesting: true });
    try {
      await memoStore.fetchPinnedMemos(user.name);
    } finally {
      setState({ isRequesting: false });
    }
  };

  useEffect(() => {
    if (user) {
      fetchPinnedMemos();
    }
  }, [user]);

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col justify-start items-start w-full max-w-full">
      {sortedMemoList.map((memo) => props.renderer(memo))}
      {state.isRequesting && (
        <div className="w-full flex flex-row justify-center items-center my-4">
          <LoaderIcon className="animate-spin text-zinc-500" />
        </div>
      )}
      {!state.isRequesting && sortedMemoList.length === 0 && (
        <div className="w-full mt-12 mb-8 flex flex-col justify-center items-center italic">
          <Empty />
          <p className="mt-2 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
        </div>
      )}
    </div>
  );
};

export default PinnedMemoList;
