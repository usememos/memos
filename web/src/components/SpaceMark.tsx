import SpaceIcon from "@/components/SpaceIcon";
import { cn } from "@/lib/utils";
import type { Space_Icon } from "@/types/proto/api/v1/space_service_pb";

const MARK_SCALE = {
  xl: { mark: "size-11 rounded-lg", icon: "size-6", emoji: "text-2xl" },
  lg: { mark: "size-9 rounded-[7px]", icon: "size-5", emoji: "text-xl" },
  md: { mark: "size-7 rounded-[7px]", icon: "size-4", emoji: "text-base" },
  /** Primary chrome: kept in step with MemosLogo's header scale. */
  header: { mark: "size-6 rounded-[6px]", icon: "size-3.5", emoji: "text-base" },
  sm: { mark: "size-5 rounded-[5px]", icon: "size-3", emoji: "text-sm" },
} as const;

interface Props {
  icon?: Space_Icon;
  size?: keyof typeof MARK_SCALE;
  className?: string;
}

const SpaceMark = ({ icon, size = "md", className }: Props) => {
  const scale = MARK_SCALE[size];

  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center bg-sidebar-accent text-sidebar-accent-foreground", scale.mark, className)}
    >
      <SpaceIcon icon={icon} className={cn(scale.icon, icon?.value.case === "emoji" && scale.emoji)} />
    </span>
  );
};

export default SpaceMark;
