import { ParenthesesIcon } from "lucide-react";
import CustomIcon from "@/components/CustomIcon";
import type { MemoView_Icon } from "@/types/proto/api/v1/user_service_pb";

const MemoViewIcon = ({ icon, className }: { icon?: MemoView_Icon; className?: string }) => (
  <CustomIcon icon={icon} className={className} fallback={ParenthesesIcon} />
);

export default MemoViewIcon;
