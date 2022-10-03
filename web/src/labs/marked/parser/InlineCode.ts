export const INLINE_CODE_REG = /`([\S ]+?)`/;

const match = (rawStr: string): number => {
  const matchResult = rawStr.match(INLINE_CODE_REG);
  if (!matchResult) {
    return 0;
  }

  const matchStr = matchResult[0];
  return matchStr.length;
};

const renderer = (rawStr: string): string => {
  const parsedStr = rawStr.replace(INLINE_CODE_REG, "<code>$1</code>");
  return parsedStr;
};

export default {
  name: "inline code",
  regex: INLINE_CODE_REG,
  match,
  renderer,
};
