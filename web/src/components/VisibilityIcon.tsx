import { Globe2Icon, LockIcon, UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Visibility } from "@/types/proto/api/v1/memo_service";

interface Props {
  visibility: Visibility;
  className?: string;
}

const VisibilityIcon = (props: Props) => {
  const { className, visibility } = props;

  let VIcon = null;
  if (visibility === Visibility.PRIVATE) {
    VIcon = LockIcon;
  } else if (visibility === Visibility.PROTECTED) {
    VIcon = UsersIcon;
  } else if (visibility === Visibility.PUBLIC) {
    VIcon = Globe2Icon;
  }
  if (!VIcon) {
    return null;
  }

  return <VIcon className={cn("w-4 h-auto text-muted-foreground", className)} />;
};

export default VisibilityIcon;
