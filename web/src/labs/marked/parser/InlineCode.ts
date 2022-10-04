export const INLINE_CODE_REG = /`([\S ]+?)`/;

const renderer = (rawStr: string): string => {
  const parsedStr = rawStr.replace(INLINE_CODE_REG, "<code>$1</code>");
  return parsedStr;
};

export default {
  name: "inline code",
  regex: INLINE_CODE_REG,
  renderer,
};
