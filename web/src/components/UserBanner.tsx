import { Dropdown, Menu, MenuButton, MenuItem } from "@mui/joy";
import classNames from "classnames";
import { authServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useGlobalStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import Icon from "./Icon";
import UserAvatar from "./UserAvatar";

interface Props {
  collapsed?: boolean;
}

const UserBanner = (props: Props) => {
  const { collapsed } = props;
  const t = useTranslate();
  const globalStore = useGlobalStore();
  const { systemStatus } = globalStore.state;
  const user = useCurrentUser();
  const title = user ? user.nickname || user.username : systemStatus.customizedProfile.name || "memos";
  const avatarUrl = user ? user.avatarUrl : systemStatus.customizedProfile.logoUrl;

  const handleSignOut = async () => {
    await authServiceClient.signOut({});
    window.location.href = "/auth";
  };

  return (
    <div className="relative w-auto h-auto px-1 shrink-0">
      <Dropdown>
        <MenuButton slots={{ root: "div" }}>
          <div
            className={classNames(
              "py-1 my-1 w-auto flex flex-row justify-start items-center cursor-pointer rounded-2xl border border-transparent text-gray-800 dark:text-gray-300",
              collapsed ? "px-1" : "px-3",
            )}
          >
            <UserAvatar className="shadow shrink-0" avatarUrl={avatarUrl} />
            {!collapsed && <span className="ml-2 text-lg font-medium text-slate-800 dark:text-gray-200 shrink truncate">{title}</span>}
          </div>
        </MenuButton>
        <Menu placement="bottom-start">
          <MenuItem onClick={handleSignOut}>
            <Icon.LogOut className="w-5 h-auto opacity-60 shrink-0" />
            <span className="truncate">{t("common.sign-out")}</span>
          </MenuItem>
        </Menu>
      </Dropdown>
    </div>
  );
};

export default UserBanner;
