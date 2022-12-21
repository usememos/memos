import { escape } from "lodash-es";
import { absolutifyLink } from "../../../helpers/utils";

export const IMAGE_REG = /!\[.*?\]\((.+?)\)/;

const matcher = (rawStr: string) => {
  const matchResult = rawStr.match(IMAGE_REG);
  return matchResult;
};

const renderer = (rawStr: string): string => {
  const matchResult = matcher(rawStr);
  if (!matchResult) {
    return rawStr;
  }

  const imageUrl = absolutifyLink(escape(matchResult[1]));
  return `<img class='img' src='${imageUrl}' />`;
};

export default {
  name: "image",
  regex: IMAGE_REG,
  matcher,
  renderer,
};
