import { useInstance } from "@/contexts/InstanceContext";
import { cn } from "@/lib/utils";
import UserAvatar from "./UserAvatar";

interface Props {
  className?: string;
  collapsed?: boolean;
  compact?: boolean;
}

function MemosLogo(props: Props) {
  const { collapsed, compact } = props;
  const { generalSetting: instanceGeneralSetting } = useInstance();
  const title = instanceGeneralSetting.customProfile?.title || "Memos";
  const avatarUrl = instanceGeneralSetting.customProfile?.logoUrl || "/full-logo.webp";

  return (
    <div className={cn("relative w-full h-auto shrink-0", props.className)}>
      <div
        className={cn("w-auto flex flex-row justify-start items-center text-foreground", compact ? "px-0" : collapsed ? "px-1" : "px-3")}
      >
        <UserAvatar className={cn("shrink-0", compact && "size-7 rounded-[7px]")} avatarUrl={avatarUrl} />
        {!collapsed && (
          <span
            className={cn(
              "font-medium text-foreground shrink truncate",
              compact ? "ml-1.5 text-[14px] tracking-[-0.01em]" : "ml-2 text-lg",
            )}
          >
            {title}
          </span>
        )}
      </div>
    </div>
  );
}

export default MemosLogo;
