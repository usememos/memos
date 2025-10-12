import { ArchiveIcon, LogOutIcon, User2Icon, SquareUserIcon, SettingsIcon, BellIcon } from "lucide-react";
import { authServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { useTranslate } from "@/utils/i18n";
import UserAvatar from "./UserAvatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

interface Props {
  collapsed?: boolean;
}

const UserMenu = (props: Props) => {
  const { collapsed } = props;
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const currentUser = useCurrentUser();

  const handleSignOut = async () => {
    await authServiceClient.deleteSession({});

    // Clear user-specific localStorage items (e.g., drafts)
    // Preserve app-wide settings like theme
    const keysToPreserve = ["memos-theme", "tag-view-as-tree", "tag-tree-auto-expand", "viewStore"];
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !keysToPreserve.includes(key)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));

    window.location.href = Routes.AUTH;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={!currentUser}>
        <div className={cn("w-auto flex flex-row justify-start items-center cursor-pointer text-foreground", collapsed ? "px-1" : "px-3")}>
          {currentUser.avatarUrl ? (
            <UserAvatar className="shrink-0" avatarUrl={currentUser.avatarUrl} />
          ) : (
            <User2Icon className="w-6 mx-auto h-auto text-muted-foreground" />
          )}
          {!collapsed && (
            <span className="ml-2 text-lg font-medium text-foreground grow truncate">
              {currentUser.displayName || currentUser.username}
            </span>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => navigateTo(`/u/${encodeURIComponent(currentUser.username)}`)}>
          <SquareUserIcon className="size-4 text-muted-foreground" />
          {t("common.profile")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigateTo(Routes.ARCHIVED)}>
          <ArchiveIcon className="size-4 text-muted-foreground" />
          {t("common.archived")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigateTo(Routes.INBOX)}>
          <BellIcon className="size-4 text-muted-foreground" />
          {t("common.inbox")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigateTo(Routes.SETTING)}>
          <SettingsIcon className="size-4 text-muted-foreground" />
          {t("common.settings")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOutIcon className="size-4 text-muted-foreground" />
          {t("common.sign-out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
