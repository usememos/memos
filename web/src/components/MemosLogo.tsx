import { useInstance } from "@/contexts/InstanceContext";
import { cn } from "@/lib/utils";
import UserAvatar from "./UserAvatar";

interface Props {
  className?: string;
  collapsed?: boolean;
  compact?: boolean;
  /** Scale of the compact lockup: "md" for headers, "sm" for dense menu rows. */
  size?: "sm" | "md";
}

// Kept in step with SpaceMark in SpaceSwitcher, so the brand and a Space read as peers
// wherever the two are listed together.
const COMPACT_SCALE = {
  md: { mark: "size-7 rounded-[7px]", title: "ml-1.5 text-[14px]" },
  sm: { mark: "size-5 rounded-[5px]", title: "ml-1.5 text-ui" },
} as const;

function MemosLogo(props: Props) {
  const { collapsed, compact, size = "md" } = props;
  const scale = COMPACT_SCALE[size];
  const { generalSetting: instanceGeneralSetting } = useInstance();
  const title = instanceGeneralSetting.customProfile?.title || "Memos";
  const avatarUrl = instanceGeneralSetting.customProfile?.logoUrl || "/full-logo.webp";

  return (
    <div className={cn("relative w-full h-auto shrink-0", props.className)}>
      <div
        className={cn("w-auto flex flex-row justify-start items-center text-foreground", compact ? "px-0" : collapsed ? "px-1" : "px-3")}
      >
        <UserAvatar className={cn("shrink-0", compact && scale.mark)} avatarUrl={avatarUrl} />
        {!collapsed && (
          <span
            className={cn("font-medium text-foreground shrink truncate", compact ? cn(scale.title, "tracking-[-0.01em]") : "ml-2 text-lg")}
          >
            {title}
          </span>
        )}
      </div>
    </div>
  );
}

export default MemosLogo;
