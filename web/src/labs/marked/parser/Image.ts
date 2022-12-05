import { escape } from "lodash-es";
import { absolutifyLink } from "../../../helpers/utils";

export const IMAGE_REG = /!\[.*?\]\((.+?)\)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(IMAGE_REG);
  if (!matchResult) {
    return rawStr;
  }

  const imageUrl = absolutifyLink(escape(matchResult[1]));
  // NOTE: Get image blob from backend to avoid CORS.
  return `<img class='img' src='/o/get/image?url=${imageUrl}' />`;
};

export default {
  name: "image",
  regex: IMAGE_REG,
  renderer,
};
