export const IMAGE_REG = /!\[.*?\]\((.+?)\)/;

const match = (rawStr: string): number => {
  const matchResult = rawStr.match(IMAGE_REG);
  if (!matchResult) {
    return 0;
  }

  const matchStr = matchResult[0];
  return matchStr.length;
};

const renderer = (rawStr: string): string => {
  const parsedStr = rawStr.replace(IMAGE_REG, "<img class='img' src='$1' />");
  return parsedStr;
};

export default {
  name: "image",
  regex: IMAGE_REG,
  match,
  renderer,
};
