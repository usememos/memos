export const TAG_REG = /[^\s]?#([^\s#]+?) /;

const renderer = (rawStr: string): string => {
  const parsedStr = rawStr.replace(TAG_REG, "<span class='tag-span'>#$1</span> ");
  return parsedStr;
};

export default {
  name: "tag",
  regex: TAG_REG,
  renderer,
};
