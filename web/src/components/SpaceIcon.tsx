import CustomIcon from "@/components/CustomIcon";
import { cn } from "@/lib/utils";
import type { Space_Icon } from "@/types/proto/api/space_service_pb";

// Emoji need an explicit font size as well as a box, unlike SVG icons. The font size is the
// glyph's size, equal to the box, not app text, so it stays off the type scale. 12, 14 and 16px
// take the package's icon sizes (and their stroke); 20 and 24px have none, so they keep a box.
const ICON_SIZE = {
  12: "mu-icon-xs text-xs",
  14: "mu-icon-sm text-sm",
  16: "text-base",
  20: "size-5 text-xl",
  24: "size-6 text-2xl",
} as const;

const SpaceIcon = ({ icon, size = 16, className }: { icon?: Space_Icon; size?: keyof typeof ICON_SIZE; className?: string }) => (
  <CustomIcon icon={icon} className={cn(ICON_SIZE[size], className)} />
);

export default SpaceIcon;
