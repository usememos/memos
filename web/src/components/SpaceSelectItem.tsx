import SpaceMark from "@/components/SpaceMark";
import { SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Space_Icon } from "@/types/proto/api/space_service_pb";

interface Props {
  value: string;
  label: string;
  icon?: Space_Icon;
  className?: string;
}

const SpaceSelectItem = ({ value, label, icon, className }: Props) => (
  <SelectItem
    value={value}
    title={label}
    className={cn("[&>div:first-child]:min-w-0 [&>div:first-child]:flex-1 [&>div:first-child]:shrink", className)}
  >
    <span className="flex min-w-0 items-center gap-2">
      <SpaceMark icon={icon} size="sm" />
      <span className="truncate">{label}</span>
    </span>
  </SelectItem>
);

export default SpaceSelectItem;
