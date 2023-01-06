import { escape } from "lodash-es";
import { absolutifyLink } from "../../../helpers/utils";
import { matcher } from "../matcher";

export const IMAGE_REG = /!\[.*?\]\((.+?)\)/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, IMAGE_REG);
  if (!matchResult) {
    return rawStr;
  }

  const imageUrl = absolutifyLink(escape(matchResult[1]));
  return <img className="img" src={imageUrl} />;
};

export default {
  name: "image",
  regexp: IMAGE_REG,
  renderer,
};
