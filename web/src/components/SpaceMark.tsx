import { cn } from "@/lib/utils";
import type { Space } from "@/types/proto/api/v1/space_service_pb";

const MARK_SCALE = {
  xl: "size-11 rounded-lg text-base",
  lg: "size-9 rounded-[7px] text-sm",
  md: "size-7 rounded-[7px] text-[13px]",
  sm: "size-5 rounded-[5px] text-[11px]",
} as const;

interface Props {
  space?: Pick<Space, "title">;
  size?: keyof typeof MARK_SCALE;
  className?: string;
}

const SpaceMark = ({ space, size = "md", className }: Props) => {
  const label = space?.title.trim() || "S";
  const initial = Array.from(label)[0]?.toLocaleUpperCase() ?? "S";

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
        MARK_SCALE[size],
        className,
      )}
    >
      {initial}
    </span>
  );
};

export default SpaceMark;
