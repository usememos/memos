export const TAG_REG = /[^\s]?#([^\s#]+?) /;

const match = (rawStr: string): number => {
  const matchResult = rawStr.match(TAG_REG);
  if (!matchResult) {
    return 0;
  }

  const matchStr = matchResult[0];
  return matchStr.length;
};

const renderer = (rawStr: string): string => {
  const parsedStr = rawStr.replace(TAG_REG, "<span class='tag-span'>#$1</span> ");
  return parsedStr;
};

export default {
  name: "tag",
  regex: TAG_REG,
  match,
  renderer,
};
