import copy from "copy-to-clipboard";
import { ExternalLinkIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useParams } from "react-router-dom";
import { MemoRenderContext } from "@/components/MasonryView";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useLoading from "@/hooks/useLoading";
import { userStore } from "@/store";
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

  // Build filter using unified hook (no shortcuts, but includes pinned)
  const memoFilter = useMemoFilters({
    creatorName: user?.name,
    includeShortcuts: false,
    includePinned: true,
  });

  // Get sorting logic using unified hook
  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.NORMAL,
  });

  const handleCopyProfileLink = () => {
    if (!user) {
      return;
    }

    copy(`${window.location.origin}/u/${encodeURIComponent(user.username)}`);
    toast.success(t("message.copied"));
  };

  return (
    <section className="w-full min-h-full flex flex-col justify-start items-center">
      {!loadingState.isLoading &&
        (user ? (
          <>
            {/* User profile header - centered with max width */}
            <div className="w-full max-w-4xl mx-auto mb-8">
              <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-6 border-b border-border">
                <div className="flex items-center gap-4">
                  <UserAvatar className="w-20! h-20! drop-shadow rounded-full" avatarUrl={user?.avatarUrl} />
                  <div className="flex flex-col justify-center items-start">
                    <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">{user.displayName || user.username}</h1>
                    {user.username && user.displayName && <p className="text-sm text-muted-foreground">@{user.username}</p>}
                  </div>
                </div>
                <Button variant="outline" onClick={handleCopyProfileLink} className="shrink-0">
                  {t("common.share")}
                  <ExternalLinkIcon className="ml-1 w-4 h-auto opacity-60" />
                </Button>
              </div>
              {user.description && (
                <div className="py-4">
                  <p className="text-base text-foreground/80 whitespace-pre-wrap">{user.description}</p>
                </div>
              )}
            </div>

            {/* Memo list - full width for proper masonry layout */}
            <PagedMemoList
              renderer={(memo: Memo, context?: MemoRenderContext) => (
                <MemoView key={`${memo.name}-${memo.displayTime}`} memo={memo} showVisibility showPinned compact={context?.compact} />
              )}
              listSort={listSort}
              orderBy={orderBy}
              filter={memoFilter}
            />
          </>
        ) : (
          <div className="w-full max-w-3xl mx-auto">
            <p className="text-center text-muted-foreground mt-8">Not found</p>
          </div>
        ))}
    </section>
  );
});

export default UserProfile;
