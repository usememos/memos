export const CODE_BLOCK_REG = /^```(\S*?)\s([\s\S]*?)```(\n?)/;

const match = (rawStr: string): number => {
  const matchResult = rawStr.match(CODE_BLOCK_REG);
  if (!matchResult) {
    return 0;
  }

  const matchStr = matchResult[0];
  return matchStr.length;
};

const renderer = (rawStr: string): string => {
  const parsedStr = rawStr.replace(CODE_BLOCK_REG, "<pre lang='$1'>\n$2</pre>$3");
  return parsedStr;
};

export default {
  name: "code block",
  regex: CODE_BLOCK_REG,
  match,
  renderer,
};
