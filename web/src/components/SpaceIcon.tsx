import CustomIcon from "@/components/CustomIcon";
import { cn } from "@/lib/utils";
import type { Space_Icon } from "@/types/proto/api/space_service_pb";

// Emoji need an explicit font size as well as a box, unlike SVG icons.
const ICON_SIZE = {
  12: "size-3 text-xs",
  14: "size-3.5 text-sm",
  16: "size-4 text-base",
  20: "size-5 text-xl",
  24: "size-6 text-2xl",
} as const;

const SpaceIcon = ({ icon, size = 16, className }: { icon?: Space_Icon; size?: keyof typeof ICON_SIZE; className?: string }) => (
  <CustomIcon icon={icon} className={cn(ICON_SIZE[size], className)} />
);

export default SpaceIcon;
