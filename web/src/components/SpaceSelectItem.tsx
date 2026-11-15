import { Select } from "@usememos/ui";
import SpaceMark from "@/components/SpaceMark";
import type { Space_Icon } from "@/types/proto/api/space_service_pb";

interface Props {
  value: string;
  label: string;
  icon?: Space_Icon;
  className?: string;
}

const SpaceSelectItem = ({ value, label, icon, className }: Props) => (
  <Select.Item value={value} title={label} className={className} icon={<SpaceMark icon={icon} size="sm" />}>
    {label}
  </Select.Item>
);

export default SpaceSelectItem;
