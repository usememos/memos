import { ArchiveIcon, LogOutIcon, User2Icon, SquareUserIcon, SettingsIcon, BellIcon } from "lucide-react";
import { authServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { useTranslate } from "@/utils/i18n";
import UserAvatar from "./UserAvatar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface Props {
  collapsed?: boolean;
}

const UserBanner = (props: Props) => {
  const { collapsed } = props;
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const currentUser = useCurrentUser();

  const handleSignOut = async () => {
    await authServiceClient.deleteSession({});
    window.location.href = Routes.AUTH;
  };

  return (
    <div className="relative w-full h-auto px-1 shrink-0">
      <Popover>
        <PopoverTrigger asChild disabled={!currentUser}>
          <div
            className={cn("w-auto flex flex-row justify-start items-center cursor-pointer text-foreground", collapsed ? "px-1" : "px-3")}
          >
            {currentUser.avatarUrl ? (
              <UserAvatar className="shrink-0" avatarUrl={currentUser.avatarUrl} />
            ) : (
              <User2Icon className="w-6 mx-auto h-auto opacity-60" />
            )}
            {!collapsed && (
              <span className="ml-2 text-lg font-medium text-foreground grow truncate">
                {currentUser.displayName || currentUser.username}
              </span>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-1" style={{ zIndex: "9999" }}>
          <div className="flex flex-col text-sm gap-0.5">
            <button
              onClick={() => navigateTo(`/u/${encodeURIComponent(currentUser.username)}`)}
              className="flex items-center gap-2 px-2 py-1 text-left text-foreground hover:bg-muted outline-none rounded"
            >
              <SquareUserIcon className="w-4 h-auto opacity-60" />
              <span className="truncate">{t("common.profile")}</span>
            </button>
            <button
              onClick={() => navigateTo(Routes.ARCHIVED)}
              className="flex items-center gap-2 px-2 py-1 text-left text-foreground hover:bg-muted outline-none rounded"
            >
              <ArchiveIcon className="w-4 h-auto opacity-60" />
              <span className="truncate">{t("common.archived")}</span>
            </button>
            <button
              onClick={() => navigateTo(Routes.INBOX)}
              className="flex items-center gap-2 px-2 py-1 text-left text-foreground hover:bg-muted outline-none rounded"
            >
              <BellIcon className="w-4 h-auto opacity-60" />
              <span className="truncate">{t("common.inbox")}</span>
            </button>
            <button
              onClick={() => navigateTo(Routes.SETTING)}
              className="flex items-center gap-2 px-2 py-1 text-left text-foreground hover:bg-muted outline-none rounded"
            >
              <SettingsIcon className="w-4 h-auto opacity-60" />
              <span className="truncate">{t("common.settings")}</span>
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-2 py-1 text-left text-foreground hover:bg-muted outline-none rounded"
            >
              <LogOutIcon className="w-4 h-auto opacity-60" />
              <span className="truncate">{t("common.sign-out")}</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default UserBanner;
