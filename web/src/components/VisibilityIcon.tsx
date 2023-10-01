import classNames from "classnames";
import Icon from "./Icon";

interface Props {
  visibility: Visibility;
}

const VisibilityIcon = (props: Props) => {
  const { visibility } = props;

  let VIcon = null;
  if (visibility === "PRIVATE") {
    VIcon = Icon.Lock;
  } else if (visibility === "PROTECTED") {
    VIcon = Icon.Users;
  } else if (visibility === "PUBLIC") {
    VIcon = Icon.Globe2;
  }
  if (!VIcon) {
    return null;
  }

  return <VIcon className={classNames("w-4 h-auto text-gray-400")} />;
};

export default VisibilityIcon;
