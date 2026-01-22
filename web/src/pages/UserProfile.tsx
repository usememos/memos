import copy from "copy-to-clipboard";
import { ExternalLinkIcon, LayoutListIcon, type LucideIcon, MapIcon } from "lucide-react";
import { toast } from "react-hot-toast";
import { useParams, useSearchParams } from "react-router-dom";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import UserAvatar from "@/components/UserAvatar";
import UserMemoMap from "@/components/UserMemoMap";
import { Button } from "@/components/ui/button";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import { useUser } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

type TabView = "memos" | "map";

const TabButton = ({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all duration-200 border-b-2 rounded-t-lg",
      isActive
        ? "border-primary text-primary bg-primary/5"
        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
    )}
  >
    <Icon className="h-4 w-4" />
    {label}
  </button>
);

interface User {
  name: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  description?: string;
}

const ProfileHeader = ({ user, onCopyProfileLink, shareLabel }: { user: User; onCopyProfileLink: () => void; shareLabel: string }) => (
  <div className="border-b border-border/10 px-4 py-8 sm:px-6">
    <div className="mx-auto flex max-w-2xl gap-4 sm:gap-6">
      <UserAvatar className="h-20 w-20 shrink-0 rounded-2xl shadow-sm sm:h-24 sm:w-24" avatarUrl={user.avatarUrl} />
      <div className="flex flex-1 flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{user.displayName || user.username}</h1>
          {user.displayName && <p className="text-sm text-muted-foreground">@{user.username}</p>}
        </div>
        {user.description && <p className="text-sm text-foreground/70">{user.description}</p>}
        <Button variant="outline" size="sm" onClick={onCopyProfileLink} className="w-fit gap-2">
          <ExternalLinkIcon className="h-4 w-4" />
          {shareLabel}
        </Button>
      </div>
    </div>
  </div>
);

const UserProfile = () => {
  const t = useTranslate();
  const username = useParams().username;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("view") === "map" ? "map" : "memos") as TabView;

  const { data: user, isLoading, error } = useUser(`users/${username}`, { enabled: !!username });

  if (error && !isLoading) {
    toast.error(t("message.user-not-found"));
  }

  const memoFilter = useMemoFilters({
    creatorName: user?.name,
    includeShortcuts: false,
    includePinned: true,
  });

  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.NORMAL,
  });

  const handleCopyProfileLink = () => {
    if (!user) return;
    copy(`${window.location.origin}/u/${encodeURIComponent(user.username)}`);
    toast.success(t("message.copied"));
  };

  const toggleTab = (view: TabView) => {
    setSearchParams((prev) => {
      view === "map" ? prev.set("view", "map") : prev.delete("view");
      return prev;
    });
  };

  if (isLoading) return null;

  return (
    <section className="flex min-h-screen w-full flex-col bg-background">
      {user ? (
        <>
          <ProfileHeader user={user} onCopyProfileLink={handleCopyProfileLink} shareLabel={t("common.share")} />

          <div className="border-b border-border/10 mb-4">
            <div className="mx-auto flex max-w-2xl">
              <TabButton
                icon={LayoutListIcon}
                label={t("common.memos")}
                isActive={activeTab === "memos"}
                onClick={() => toggleTab("memos")}
              />
              <TabButton icon={MapIcon} label={t("common.map")} isActive={activeTab === "map"} onClick={() => toggleTab("map")} />
            </div>
          </div>

          <div className="flex-1">
            <div className="mx-auto w-full max-w-2xl">
              {activeTab === "memos" ? (
                <PagedMemoList
                  renderer={(memo: Memo) => (
                    <MemoView key={`${memo.name}-${memo.displayTime}`} memo={memo} showVisibility showPinned compact />
                  )}
                  listSort={listSort}
                  orderBy={orderBy}
                  filter={memoFilter}
                />
              ) : (
                <div className="">
                  <UserMemoMap creator={user.name} className="h-[60dvh] sm:h-[500px] rounded-xl" />
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">{t("message.user-not-found")}</p>
        </div>
      )}
    </section>
  );
};

export default UserProfile;
