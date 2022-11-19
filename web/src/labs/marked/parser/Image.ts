import { escape } from "lodash-es";

export const IMAGE_REG = /!\[.*?\]\((.+?)\)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(IMAGE_REG);
  if (!matchResult) {
    return rawStr;
  }

  // NOTE: Get image blob from backend to avoid CORS.
  return `<img class='img' src='/o/get/image?url=${escape(matchResult[1])}' />`;
};

export default {
  name: "image",
  regex: IMAGE_REG,
  renderer,
};
