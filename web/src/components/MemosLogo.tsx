import { useInstance } from "@/contexts/InstanceContext";
import { cn } from "@/lib/utils";
import UserAvatar from "./UserAvatar";

interface Props {
  className?: string;
  collapsed?: boolean;
  compact?: boolean;
  /** Scale of the compact lockup: "header" for primary chrome, "md" for roomy surfaces, and "sm" for dense menu rows. */
  size?: keyof typeof COMPACT_SCALE;
}

// Kept in step with SpaceMark in SpaceSwitcher, so the brand and a Space read as peers
// wherever the two are listed together.
const COMPACT_SCALE = {
  md: { mark: "size-7 rounded-[7px]", gap: "gap-1.5", title: "text-[14px]", weight: "font-medium" },
  header: { mark: "size-6 rounded-[6px]", gap: "gap-2", title: "text-[15px] leading-5", weight: "font-semibold" },
  sm: { mark: "size-5 rounded-[5px]", gap: "gap-1.5", title: "text-ui", weight: "font-medium" },
} as const;

function MemosLogo(props: Props) {
  const { collapsed, compact, size = "md" } = props;
  const scale = COMPACT_SCALE[size];
  const { generalSetting: instanceGeneralSetting } = useInstance();
  const title = instanceGeneralSetting.customProfile?.title || "Memos";
  const avatarUrl = instanceGeneralSetting.customProfile?.logoUrl || "/full-logo.webp";

  return (
    <div className={cn("relative min-w-0 h-auto", props.className)}>
      <div
        className={cn(
          "flex min-w-0 flex-row items-center justify-start text-foreground",
          compact ? cn("px-0", scale.gap) : collapsed ? "px-1" : "gap-2 px-3",
        )}
      >
        <UserAvatar className={cn("shrink-0", compact && scale.mark)} avatarUrl={avatarUrl} />
        {!collapsed && (
          <span
            className={cn(
              "shrink truncate text-foreground",
              compact ? cn(scale.title, scale.weight, "tracking-[-0.01em]") : "text-lg font-medium",
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
