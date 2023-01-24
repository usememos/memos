import { absolutifyLink } from "../../../helpers/utils";
import { matcher } from "../matcher";

export const IMAGE_REG = /!\[.*?\]\((.+?)\)/;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const renderer = (rawStr: string, highlightWord?: string) => {
  const matchResult = matcher(rawStr, IMAGE_REG);
  if (!matchResult) {
    return rawStr;
  }

  const imageUrl = absolutifyLink(matchResult[1]);
  return <img className="img" src={imageUrl} />;
};

export default {
  name: "image",
  regexp: IMAGE_REG,
  renderer,
};
