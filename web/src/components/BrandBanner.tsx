import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { Routes } from "@/router";
import { workspaceStore } from "@/store/v2";
import { cn } from "@/utils";
import UserAvatar from "./UserAvatar";

interface Props {
  className?: string;
  collapsed?: boolean;
}

const BrandBanner = (props: Props) => {
  const { collapsed } = props;
  const navigateTo = useNavigateTo();
  const currentUser = useCurrentUser();
  const workspaceGeneralSetting = workspaceStore.state.generalSetting;
  const title = workspaceGeneralSetting.customProfile?.title || "Memos";
  const avatarUrl = workspaceGeneralSetting.customProfile?.logoUrl || "/full-logo.webp";

  return (
    <div className={cn("relative w-full h-auto shrink-0", props.className)}>
      <div
        className={cn("w-auto flex flex-row justify-start items-center text-gray-800 dark:text-gray-400", collapsed ? "px-1" : "px-3")}
        onClick={() => navigateTo(currentUser ? Routes.ROOT : Routes.EXPLORE)}
      >
        <UserAvatar className="shrink-0" avatarUrl={avatarUrl} />
        {!collapsed && <span className="ml-2 text-lg font-medium text-slate-800 dark:text-gray-300 shrink truncate">{title}</span>}
      </div>
    </div>
  );
};

export default BrandBanner;
