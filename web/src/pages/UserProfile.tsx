import { Button } from "@usememos/mui";
import copy from "copy-to-clipboard";
import dayjs from "dayjs";
import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useParams } from "react-router-dom";
import MemoFilters from "@/components/MemoFilters";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import UserAvatar from "@/components/UserAvatar";
import useLoading from "@/hooks/useLoading";
import { useMemoFilterStore } from "@/store/v1";
import { userStore } from "@/store/v2";
import { Direction, State } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { User } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";

const UserProfile = () => {
  const t = useTranslate();
  const params = useParams();
  const loadingState = useLoading();
  const [user, setUser] = useState<User>();
  const memoFilterStore = useMemoFilterStore();

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

  const memoListFilter = useMemo(() => {
    if (!user) {
      return "";
    }

    const conditions = [];
    const contentSearch: string[] = [];
    const tagSearch: string[] = [];
    for (const filter of memoFilterStore.filters) {
      if (filter.factor === "contentSearch") {
        contentSearch.push(`"${filter.value}"`);
      } else if (filter.factor === "tagSearch") {
        tagSearch.push(`"${filter.value}"`);
      }
    }
    if (contentSearch.length > 0) {
      conditions.push(`content_search == [${contentSearch.join(", ")}]`);
    }
    if (tagSearch.length > 0) {
      conditions.push(`tag_search == [${tagSearch.join(", ")}]`);
    }
    return conditions.join(" && ");
  }, [user, memoFilterStore.filters]);

  const handleCopyProfileLink = () => {
    if (!user) {
      return;
    }

    copy(`${window.location.origin}/u/${encodeURIComponent(user.username)}`);
    toast.success(t("message.copied"));
  };

  return (
    <section className="w-full max-w-3xl mx-auto min-h-full flex flex-col justify-start items-center pb-8">
      <div className="w-full px-4 sm:px-6 flex flex-col justify-start items-center">
        {!loadingState.isLoading &&
          (user ? (
            <>
              <div className="my-4 w-full flex justify-end items-center gap-2">
                <Button variant="outlined" onClick={handleCopyProfileLink}>
                  {t("common.share")}
                  <ExternalLinkIcon className="ml-1 w-4 h-auto opacity-60" />
                </Button>
              </div>
              <div className="w-full flex flex-col justify-start items-start pt-4 pb-8 px-3">
                <UserAvatar className="!w-16 !h-16 drop-shadow rounded-3xl" avatarUrl={user?.avatarUrl} />
                <div className="mt-2 w-auto max-w-[calc(100%-6rem)] flex flex-col justify-center items-start">
                  <p className="w-full text-3xl text-black leading-tight font-medium opacity-80 dark:text-gray-200 truncate">
                    {user.nickname || user.username}
                  </p>
                  <p className="w-full text-gray-500 leading-snug dark:text-gray-400 whitespace-pre-wrap truncate line-clamp-6">
                    {user.description}
                  </p>
                </div>
              </div>
              <MemoFilters />
              <PagedMemoList
                renderer={(memo: Memo) => (
                  <MemoView key={`${memo.name}-${memo.displayTime}`} memo={memo} showVisibility showPinned compact />
                )}
                listSort={(memos: Memo[]) =>
                  memos
                    .filter((memo) => memo.state === State.NORMAL)
                    .sort((a, b) =>
                      memoFilterStore.orderByTimeAsc
                        ? dayjs(a.displayTime).unix() - dayjs(b.displayTime).unix()
                        : dayjs(b.displayTime).unix() - dayjs(a.displayTime).unix(),
                    )
                    .sort((a, b) => Number(b.pinned) - Number(a.pinned))
                }
                owner={user.name}
                direction={memoFilterStore.orderByTimeAsc ? Direction.ASC : Direction.DESC}
                oldFilter={memoListFilter}
              />
            </>
          ) : (
            <p>Not found</p>
          ))}
      </div>
    </section>
  );
};

export default UserProfile;
