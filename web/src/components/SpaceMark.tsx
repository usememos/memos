import SpaceIcon from "@/components/SpaceIcon";
import { cn } from "@/lib/utils";
import type { Space_Icon } from "@/types/proto/api/space_service_pb";

const MARK_SCALE = {
  xl: { mark: "size-11 rounded-lg", icon: 24, emoji: "text-2xl" },
  lg: { mark: "size-9 rounded-[7px]", icon: 20, emoji: "text-xl" },
  md: { mark: "size-7 rounded-[7px]", icon: 16, emoji: "text-base" },
  /** Primary chrome: kept in step with MemosLogo's header scale. */
  header: { mark: "size-6 rounded-[6px]", icon: 14, emoji: "text-base" },
  sm: { mark: "size-5 rounded-[5px]", icon: 12, emoji: "text-sm" },
} as const;

interface Props {
  icon?: Space_Icon;
  size?: keyof typeof MARK_SCALE;
  className?: string;
}

// Identity surfaces and Space selectors use a mark; inline references use SpaceIcon.
const SpaceMark = ({ icon, size = "md", className }: Props) => {
  const scale = MARK_SCALE[size];

  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center bg-sidebar-accent text-sidebar-accent-foreground", scale.mark, className)}
    >
      <SpaceIcon icon={icon} size={scale.icon} className={cn(icon?.value.case === "emoji" && scale.emoji)} />
    </span>
  );
};

export default SpaceMark;
