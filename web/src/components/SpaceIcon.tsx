import CustomIcon from "@/components/CustomIcon";
import type { Space_Icon } from "@/types/proto/api/v1/space_service_pb";

const SpaceIcon = ({ icon, className }: { icon?: Space_Icon; className?: string }) => <CustomIcon icon={icon} className={className} />;

export default SpaceIcon;
