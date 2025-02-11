import { Dropdown, Menu, MenuButton, MenuItem } from "@mui/joy";
import { LogOutIcon, SmileIcon } from "lucide-react";
import { authServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { Routes } from "@/router";
import { workspaceStore } from "@/store/v2";
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
  const user = useCurrentUser();
  const workspaceGeneralSetting = workspaceStore.state.generalSetting;
  const title = (user ? user.nickname || user.username : workspaceGeneralSetting.customProfile?.title) || "Memos";
  const avatarUrl = (user ? user.avatarUrl : workspaceGeneralSetting.customProfile?.logoUrl) || "/full-logo.webp";

  const handleSignOut = async () => {
    await authServiceClient.signOut({});
    window.location.href = "/auth";
  };

  return (
    <div className="relative w-full h-auto px-1 shrink-0">
      <Dropdown>
        <MenuButton disabled={!user} slots={{ root: "div" }}>
          <div
            className={cn(
              "py-1 w-auto flex flex-row justify-start items-center cursor-pointer text-gray-800 dark:text-gray-400",
              collapsed ? "px-1" : "px-3",
            )}
          >
            <UserAvatar className="shrink-0" avatarUrl={avatarUrl} />
            {!collapsed && <span className="ml-2 text-lg font-medium text-slate-800 dark:text-gray-300 shrink truncate">{title}</span>}
          </div>
        </MenuButton>
        <Menu placement="bottom-start" style={{ zIndex: "9999" }}>
          <MenuItem onClick={handleSignOut}>
            <LogOutIcon className="w-4 h-auto opacity-60" />
            <span className="truncate">{t("common.sign-out")}</span>
          </MenuItem>
          <MenuItem onClick={() => navigateTo(Routes.ABOUT)}>
            <SmileIcon className="w-4 h-auto opacity-60" />
            <span className="truncate">{t("common.about")}</span>
          </MenuItem>
        </Menu>
      </Dropdown>
    </div>
  );
};

export default UserBanner;
