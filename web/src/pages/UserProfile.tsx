import { UserRoundIcon } from "lucide-react";
import { type ReactNode, Suspense } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import MemoView from "@/components/MemoView";
import PagedMemoList, { getMemoKey } from "@/components/PagedMemoList";
import UserAvatar from "@/components/UserAvatar";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { useUser } from "@/hooks/useUserQueries";
import { LOADING_INDICATOR_DELAY_MS } from "@/lib/constants";
import { userNamePrefix } from "@/lib/resource-names";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/router/routes";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";
import type { User } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import { lazyWithReload } from "@/utils/lazy";

type TabView = "memos" | "map";

const UserMemoMap = lazyWithReload(() => import("@/components/UserMemoMap"));

const PROFILE_TITLE_CLASSES = "text-xl font-semibold leading-7 tracking-[-0.01em] text-foreground";
const PROFILE_AVATAR_SLOT_CLASSES = "mt-0.5 size-10 shrink-0 rounded-lg";

// The identity block sits on the content rail like everything else on the page: a 40px
// avatar slot beside a text column. The loaded, loading and not-found states all share
// this shell so they occupy the same space and swap without a jump.
const IdentityRow = ({ avatar, className, children }: { avatar: ReactNode; className?: string; children: ReactNode }) => (
  <div className={cn("flex w-full items-start gap-3", className)}>
    {avatar}
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

// The list's header, so in grid mode it spans every column.
const ProfileHeader = ({ user, className }: { user: User; className?: string }) => (
  <IdentityRow className={className} avatar={<UserAvatar className={PROFILE_AVATAR_SLOT_CLASSES} avatarUrl={user.avatarUrl} />}>
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      <h1 className={cn("truncate", PROFILE_TITLE_CLASSES)}>{user.displayName || user.username}</h1>
      {user.displayName && <span className="text-ui text-muted-foreground">@{user.username}</span>}
    </div>
    {user.description && <p className="mt-0.5 line-clamp-2 max-w-[60ch] text-ui text-muted-foreground">{user.description}</p>}
  </IdentityRow>
);

const ProfileHeaderSkeleton = () => (
  <div aria-busy="true">
    <IdentityRow avatar={<span className={cn(PROFILE_AVATAR_SLOT_CLASSES, "animate-pulse bg-muted")} />}>
      <span className="mt-1 block h-5 w-40 animate-pulse rounded bg-muted" />
      <span className="mt-2 block h-3.5 w-3/5 animate-pulse rounded bg-muted" />
    </IdentityRow>
  </div>
);

const ProfileNotFound = ({ username }: { username: string }) => {
  const t = useTranslate();
  return (
    <IdentityRow
      avatar={
        <span
          className={cn(PROFILE_AVATAR_SLOT_CLASSES, "grid place-items-center border border-dashed border-input text-muted-foreground/60")}
        >
          <UserRoundIcon className="size-5" strokeWidth={1.6} />
        </span>
      }
    >
      <h1 className={PROFILE_TITLE_CLASSES}>{t("profile.not-found-title")}</h1>
      <p className="mt-0.5 max-w-[60ch] text-ui text-muted-foreground">{t("profile.not-found-description", { username })}</p>
      <Link to={ROUTES.EXPLORE} className="mt-3 block w-fit text-ui text-primary hover:underline">
        {t("common.explore")}
      </Link>
    </IdentityRow>
  );
};

const UserProfile = () => {
  const t = useTranslate();
  const username = useParams().username ?? "";
  const [searchParams] = useSearchParams();
  const currentUser = useCurrentUser();
  const activeTab = (searchParams.get("view") === "map" ? "map" : "memos") as TabView;

  const { data: user, isLoading } = useUser(`${userNamePrefix}${username}`, { enabled: !!username });
  const showSkeleton = useDelayedFlag(isLoading, LOADING_INDICATOR_DELAY_MS);

  const memoFilter = useMemoFilters({
    creatorName: user?.name,
    includeMemoViews: true,
    includePinned: true,
  });

  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.NORMAL,
  });

  if (user && activeTab === "memos") {
    // Visitors only see what the backend lets them see, so an empty list means nothing
    // shared rather than nothing written. The owner sees everything and gets the default.
    const isOwner = currentUser?.name === user.name;
    return (
      <PagedMemoList
        renderer={(memo: Memo, { compact }) => (
          <MemoView key={getMemoKey(memo)} memo={memo} showVisibility showPinned showSpace compact={compact} />
        )}
        listSort={listSort}
        orderBy={orderBy}
        filter={memoFilter}
        emptyMessage={isOwner ? undefined : t("profile.no-shared-memos", { username: user.username })}
        renderHeader={({ useGrid }) => <ProfileHeader user={user} className={useGrid ? undefined : "mb-4"} />}
      />
    );
  }

  // Everything that is not the list shares the list's single-column reading rail.
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {isLoading ? (
        showSkeleton && <ProfileHeaderSkeleton />
      ) : !user ? (
        <ProfileNotFound username={username} />
      ) : (
        <>
          <ProfileHeader user={user} />
          <Suspense fallback={<div className="h-[60dvh] rounded-xl border border-border bg-muted/30 sm:h-[500px]" />}>
            <UserMemoMap creator={user.name} className="h-[60dvh] rounded-xl sm:h-[500px]" />
          </Suspense>
        </>
      )}
    </section>
  );
};

export default UserProfile;
