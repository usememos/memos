export const IMAGE_REG = /!\[.*?\]\((.+?)\)/;

const renderer = (rawStr: string): string => {
  const parsedStr = rawStr.replace(IMAGE_REG, "<img class='img' src='$1' />");
  return parsedStr;
};

export default {
  name: "image",
  regex: IMAGE_REG,
  renderer,
};
