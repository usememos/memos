import copy from "copy-to-clipboard";
import dayjs from "dayjs";
import { ExternalLinkIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useParams } from "react-router-dom";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import useLoading from "@/hooks/useLoading";
import { viewStore, userStore } from "@/store";
import { extractUserIdFromName } from "@/store/common";
import memoFilterStore from "@/store/memoFilter";
import { State } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { User } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";

const UserProfile = observer(() => {
  const t = useTranslate();
  const params = useParams();
  const loadingState = useLoading();
  const [user, setUser] = useState<User>();

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

  const memoFilter = useMemo(() => {
    if (!user) {
      return undefined;
    }

    const conditions = [`creator_id == ${extractUserIdFromName(user.name)}`];
    for (const filter of memoFilterStore.filters) {
      if (filter.factor === "contentSearch") {
        conditions.push(`content.contains("${filter.value}")`);
      } else if (filter.factor === "tagSearch") {
        conditions.push(`tag in ["${filter.value}"]`);
      }
    }
    return conditions.length > 0 ? conditions.join(" && ") : undefined;
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
      <div className="w-full flex flex-col justify-start items-center max-w-2xl">
        {!loadingState.isLoading &&
          (user ? (
            <>
              <div className="my-4 w-full flex justify-end items-center gap-2">
                <Button variant="outline" onClick={handleCopyProfileLink}>
                  {t("common.share")}
                  <ExternalLinkIcon className="ml-1 w-4 h-auto opacity-60" />
                </Button>
              </div>
              <div className="w-full flex flex-col justify-start items-start pt-4 pb-8 px-3">
                <UserAvatar className="w-16! h-16! drop-shadow rounded-3xl" avatarUrl={user?.avatarUrl} />
                <div className="mt-2 w-auto max-w-[calc(100%-6rem)] flex flex-col justify-center items-start">
                  <p className="w-full text-3xl text-foreground leading-tight font-medium opacity-80 truncate">
                    {user.displayName || user.username}
                  </p>
                  <p className="w-full text-muted-foreground leading-snug whitespace-pre-wrap truncate line-clamp-6">{user.description}</p>
                </div>
              </div>
              <PagedMemoList
                renderer={(memo: Memo) => (
                  <MemoView key={`${memo.name}-${memo.displayTime}`} memo={memo} showVisibility showPinned compact />
                )}
                listSort={(memos: Memo[]) =>
                  memos
                    .filter((memo) => memo.state === State.NORMAL)
                    .sort((a, b) =>
                      viewStore.state.orderByTimeAsc
                        ? dayjs(a.displayTime).unix() - dayjs(b.displayTime).unix()
                        : dayjs(b.displayTime).unix() - dayjs(a.displayTime).unix(),
                    )
                }
                orderBy={viewStore.state.orderByTimeAsc ? "display_time asc" : "display_time desc"}
                filter={memoFilter}
              />
            </>
          ) : (
            <p>Not found</p>
          ))}
      </div>
    </section>
  );
});

export default UserProfile;
