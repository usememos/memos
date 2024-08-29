import clsx from "clsx";
import { Globe2Icon, LockIcon, UsersIcon } from "lucide-react";
import { Visibility } from "@/types/proto/api/v1/memo_service";

interface Props {
  visibility: Visibility;
}

const VisibilityIcon = (props: Props) => {
  const { visibility } = props;

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

  return <VIcon className={clsx("w-4 h-auto text-gray-500 dark:text-gray-400")} />;
};

export default VisibilityIcon;
