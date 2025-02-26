import { Dropdown, Menu, MenuButton, MenuItem } from "@mui/joy";
import { LogOutIcon, User2Icon, SmileIcon } from "lucide-react";
import { authServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { Routes } from "@/router";
import { cn } from "@/utils";
import { useTranslate } from "@/utils/i18n";
import UserAvatar from "./UserAvatar";

interface Props {
  collapsed?: boolean;
}

const UserBanner = (props: Props) => {
  const { collapsed } = props;
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const currentUser = useCurrentUser();

  const handleSignOut = async () => {
    await authServiceClient.signOut({});
    window.location.href = Routes.AUTH;
  };

  return (
    <div className="relative w-full h-auto px-1 shrink-0">
      <Dropdown>
        <MenuButton disabled={!currentUser} slots={{ root: "div" }}>
          <div
            className={cn(
              "w-auto flex flex-row justify-start items-center cursor-pointer text-gray-800 dark:text-gray-400",
              collapsed ? "px-1" : "px-3",
            )}
            onClick={() => navigateTo(currentUser ? Routes.ROOT : Routes.EXPLORE)}
          >
            {currentUser.avatarUrl ? (
              <UserAvatar className="shrink-0" avatarUrl={currentUser.avatarUrl} />
            ) : (
              <User2Icon className="w-6 mx-auto h-auto opacity-60" />
            )}
            {!collapsed && (
              <span className="ml-2 text-lg font-medium text-slate-800 dark:text-gray-300 grow truncate">
                {currentUser.nickname || currentUser.username}
              </span>
            )}
          </div>
        </MenuButton>
        <Menu placement="bottom-start" style={{ zIndex: "9999" }}>
          <MenuItem onClick={() => navigateTo(`/u/${encodeURIComponent(currentUser.username)}`)}>
            <SmileIcon className="w-4 h-auto opacity-60" />
            <span className="truncate">{t("common.profile")}</span>
          </MenuItem>
          <MenuItem onClick={handleSignOut}>
            <LogOutIcon className="w-4 h-auto opacity-60" />
            <span className="truncate">{t("common.sign-out")}</span>
          </MenuItem>
        </Menu>
      </Dropdown>
    </div>
  );
};

export default UserBanner;
