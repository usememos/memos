import { Button } from "@mui/joy";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useParams } from "react-router-dom";
import Empty from "@/components/Empty";
import Icon from "@/components/Icon";
import MemoFilter from "@/components/MemoFilter";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import UserAvatar from "@/components/UserAvatar";
import { DEFAULT_MEMO_LIMIT } from "@/helpers/consts";
import { getTimeStampByDate } from "@/helpers/datetime";
import useLoading from "@/hooks/useLoading";
import { useFilterStore } from "@/store/module";
import { useMemoList, useMemoStore, useUserStore } from "@/store/v1";
import { User } from "@/types/proto/api/v2/user_service";
import { useTranslate } from "@/utils/i18n";

const UserProfile = () => {
  const t = useTranslate();
  const params = useParams();
  const userStore = useUserStore();
  const loadingState = useLoading();
  const filterStore = useFilterStore();
  const [user, setUser] = useState<User>();
  const memoStore = useMemoStore();
  const memoList = useMemoList();
  const [isRequesting, setIsRequesting] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const { tag: tagQuery, text: textQuery } = filterStore.state;
  const sortedMemos = memoList.value
    .sort((a, b) => getTimeStampByDate(b.displayTime) - getTimeStampByDate(a.displayTime))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  useEffect(() => {
    const username = params.username;
    if (!username) {
      throw new Error("username is required");
    }

    userStore
      .getOrFetchUserByUsername(username)
      .then((user) => {
        setUser(user);
        loadingState.setFinish();
      })
      .catch((error) => {
        console.error(error);
        toast.error(t("message.user-not-found"));
      });
  }, [params.username]);

  useEffect(() => {
    if (!user) {
      return;
    }

    memoList.reset();
    fetchMemos();
  }, [user, tagQuery, textQuery]);

  const fetchMemos = async () => {
    if (!user) {
      return;
    }

    const filters = [`creator == "${user.name}"`, `row_status == "NORMAL"`, `order_by_pinned == true`];
    const contentSearch: string[] = [];
    if (tagQuery) {
      contentSearch.push(`"#${tagQuery}"`);
    }
    if (textQuery) {
      contentSearch.push(`"${textQuery}"`);
    }
    if (contentSearch.length > 0) {
      filters.push(`content_search == [${contentSearch.join(", ")}]`);
    }
    setIsRequesting(true);
    const data = await memoStore.fetchMemos({
      filter: filters.join(" && "),
      limit: DEFAULT_MEMO_LIMIT,
      offset: memoList.size(),
    });
    setIsRequesting(false);
    setIsComplete(data.length < DEFAULT_MEMO_LIMIT);
  };

  return (
    <section className="w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="w-full px-4 sm:px-6 flex flex-col justify-start items-center">
        {!loadingState.isLoading &&
          (user ? (
            <>
              <div className="relative -mt-6 top-8 w-full flex justify-end items-center">
                <a className="" href={`/u/${user?.id}/rss.xml`} target="_blank" rel="noopener noreferrer">
                  <Button color="neutral" variant="outlined" endDecorator={<Icon.Rss className="w-4 h-auto opacity-60" />}>
                    RSS
                  </Button>
                </a>
              </div>
              <div className="w-full flex flex-col justify-start items-center py-8">
                <UserAvatar className="!w-20 !h-20 mb-2 drop-shadow" avatarUrl={user?.avatarUrl} />
                <div className="w-full flex flex-row justify-center items-center">
                  <p className="text-3xl text-black leading-none opacity-80 dark:text-gray-200">{user?.nickname}</p>
                </div>
              </div>
              <MemoFilter className="px-2 pb-3" />
              {sortedMemos.map((memo) => (
                <MemoView key={memo.id} memo={memo} showVisibility showPinned />
              ))}
              {isRequesting ? (
                <div className="flex flex-col justify-start items-center w-full my-4">
                  <p className="text-sm text-gray-400 italic">{t("memo.fetching-data")}</p>
                </div>
              ) : isComplete ? (
                sortedMemos.length === 0 && (
                  <div className="w-full mt-12 mb-8 flex flex-col justify-center items-center italic">
                    <Empty />
                    <p className="mt-2 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
                  </div>
                )
              ) : (
                <div className="w-full flex flex-row justify-center items-center my-4">
                  <Button variant="plain" endDecorator={<Icon.ArrowDown className="w-5 h-auto" />} onClick={fetchMemos}>
                    {t("memo.fetch-more")}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p>Not found</p>
          ))}
      </div>
    </section>
  );
};

export default UserProfile;
