import { escape } from "lodash-es";

export const IMAGE_REG = /!\[.*?\]\((.+?)\)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(IMAGE_REG);
  if (!matchResult) {
    return rawStr;
  }

  return `<img class='img' src='${escape(matchResult[1])}' />`;
};

export default {
  name: "image",
  regex: IMAGE_REG,
  renderer,
};
