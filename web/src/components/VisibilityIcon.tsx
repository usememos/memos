import classNames from "classnames";
import { Visibility } from "@/types/proto/api/v2/memo_service";
import Icon from "./Icon";

interface Props {
  visibility: Visibility;
}

const VisibilityIcon = (props: Props) => {
  const { visibility } = props;

  let VIcon = null;
  if (visibility === Visibility.PRIVATE) {
    VIcon = Icon.Lock;
  } else if (visibility === Visibility.PROTECTED) {
    VIcon = Icon.Users;
  } else if (visibility === Visibility.PUBLIC) {
    VIcon = Icon.Globe2;
  }
  if (!VIcon) {
    return null;
  }

  return <VIcon className={classNames("w-4 h-auto text-gray-400")} />;
};

export default VisibilityIcon;
