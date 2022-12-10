import { escape } from "lodash-es";
import { absolutifyLink } from "../../../helpers/utils";

export const IMAGE_REG = /!\[.*?\]\((.+?)\)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(IMAGE_REG);
  if (!matchResult) {
    return rawStr;
  }

  const imageUrl = absolutifyLink(escape(matchResult[1]));
  return `<img class='img' src='${imageUrl}' />`;
};

export default {
  name: "image",
  regex: IMAGE_REG,
  renderer,
};
