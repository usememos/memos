import { cn } from "@/lib/utils";
import type { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { getVisibilityOption } from "@/utils/memo";

interface Props {
  visibility: Visibility;
  className?: string;
}

const VisibilityIcon = (props: Props) => {
  const { className, visibility } = props;
  const VIcon = getVisibilityOption(visibility)?.icon;

  if (!VIcon) {
    return null;
  }

  return <VIcon className={cn("size-4 text-muted-foreground", className)} strokeWidth={1.8} />;
};

export default VisibilityIcon;
