import { Button } from "@mui/joy";
import copy from "copy-to-clipboard";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useParams } from "react-router-dom";
import Empty from "@/components/Empty";
import Icon from "@/components/Icon";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import UserAvatar from "@/components/UserAvatar";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import { getTimeStampByDate } from "@/helpers/datetime";
import useFilterWithUrlParams from "@/hooks/useFilterWithUrlParams";
import useLoading from "@/hooks/useLoading";
import { useMemoList, useMemoStore, useUserStore } from "@/store/v1";
import { User } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";

const UserProfile = () => {
  const t = useTranslate();
  const params = useParams();
  const userStore = useUserStore();
  const loadingState = useLoading();
  const [user, setUser] = useState<User>();
  const memoStore = useMemoStore();
  const memoList = useMemoList();
  const [isRequesting, setIsRequesting] = useState(true);
  const [nextPageToken, setNextPageToken] = useState<string>("");
  const { tag: tagQuery, text: textQuery } = useFilterWithUrlParams();
  const sortedMemos = memoList.value
    .sort((a, b) => getTimeStampByDate(b.displayTime) - getTimeStampByDate(a.displayTime))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  useEffect(() => {
    const username = params.username;
    if (!username) {
      throw new Error("username is required");
    }

    userStore
      .searchUsers(`username == "${username}"`)
      .then((users) => {
        if (users.length !== 1) {
          throw new Error("User not found");
        }
        const user = users[0];
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
    fetchMemos("");
  }, [user, tagQuery, textQuery]);

  const fetchMemos = async (nextPageToken: string) => {
    if (!user) {
      return;
    }

    setIsRequesting(true);
    const filters = [`creator == "${user.name}"`, `row_status == "NORMAL"`, `order_by_pinned == true`];
    const contentSearch: string[] = [];
    if (textQuery) {
      contentSearch.push(JSON.stringify(textQuery));
    }
    if (contentSearch.length > 0) {
      filters.push(`content_search == [${contentSearch.join(", ")}]`);
    }
    if (tagQuery) {
      filters.push(`tag == "${tagQuery}"`);
    }
    const response = await memoStore.fetchMemos({
      pageSize: DEFAULT_LIST_MEMOS_PAGE_SIZE,
      filter: filters.join(" && "),
      pageToken: nextPageToken,
    });
    setIsRequesting(false);
    setNextPageToken(response.nextPageToken);
  };

  const handleCopyProfileLink = () => {
    if (!user) {
      return;
    }

    copy(`${window.location.origin}/u/${encodeURIComponent(user.username)}`);
    toast.success(t("message.copied"));
  };

  return (
    <section className="w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="w-full px-4 sm:px-6 flex flex-col justify-start items-center">
        {!loadingState.isLoading &&
          (user ? (
            <>
              <div className="my-4 w-full flex justify-end items-center gap-2">
                <a className="" href={`/u/${encodeURIComponent(user?.username)}/rss.xml`} target="_blank" rel="noopener noreferrer">
                  <Button color="neutral" variant="outlined" endDecorator={<Icon.Rss className="w-4 h-auto opacity-60" />}>
                    RSS
                  </Button>
                </a>
                <Button
                  color="neutral"
                  variant="outlined"
                  endDecorator={<Icon.ExternalLink className="w-4 h-auto opacity-60" />}
                  onClick={handleCopyProfileLink}
                >
                  {t("common.share")}
                </Button>
              </div>
              <div className="w-full flex flex-col justify-start items-start pt-4 pb-8 px-3">
                <UserAvatar className="!w-16 !h-16 drop-shadow rounded-3xl" avatarUrl={user?.avatarUrl} />
                <div className="mt-2 w-auto max-w-[calc(100%-6rem)] flex flex-col justify-center items-start">
                  <p className="w-full text-3xl text-black leading-tight opacity-80 dark:text-gray-200 truncate">
                    {user.nickname || user.username}
                  </p>
                  <p className="w-full text-gray-500 leading-snug opacity-80 dark:text-gray-400 whitespace-pre-wrap truncate line-clamp-6">
                    {user.description}
                  </p>
                </div>
              </div>
              {sortedMemos.map((memo) => (
                <MemoView key={`${memo.name}-${memo.displayTime}`} memo={memo} showVisibility showPinned compact />
              ))}
              {isRequesting ? (
                <div className="flex flex-row justify-center items-center w-full my-4 text-gray-400">
                  <Icon.Loader className="w-4 h-auto animate-spin mr-1" />
                  <p className="text-sm italic">{t("memo.fetching-data")}</p>
                </div>
              ) : !nextPageToken ? (
                sortedMemos.length === 0 && (
                  <div className="w-full mt-12 mb-8 flex flex-col justify-center items-center italic">
                    <Empty />
                    <p className="mt-2 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
                  </div>
                )
              ) : (
                <div className="w-full flex flex-row justify-center items-center my-4">
                  <Button
                    variant="plain"
                    endDecorator={<Icon.ArrowDown className="w-5 h-auto" />}
                    onClick={() => fetchMemos(nextPageToken)}
                  >
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
