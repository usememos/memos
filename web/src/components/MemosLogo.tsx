import { useInstance } from "@/contexts/InstanceContext";
import { cn } from "@/lib/utils";
import UserAvatar from "./UserAvatar";

interface Props {
  className?: string;
  collapsed?: boolean;
}

function MemosLogo(props: Props) {
  const { collapsed } = props;
  const { generalSetting: instanceGeneralSetting } = useInstance();
  const title = instanceGeneralSetting.customProfile?.title || "Memos";
  const avatarUrl = instanceGeneralSetting.customProfile?.logoUrl || "/full-logo.webp";

  return (
    <div className={cn("relative w-full h-auto shrink-0", props.className)}>
      <div className={cn("w-auto flex flex-row justify-start items-center text-foreground", collapsed ? "px-1" : "px-3")}>
        <UserAvatar className="shrink-0" avatarUrl={avatarUrl} />
        {!collapsed && <span className="ml-2 text-lg font-medium text-foreground shrink truncate">{title}</span>}
      </div>
    </div>
  );
}

export default MemosLogo;
