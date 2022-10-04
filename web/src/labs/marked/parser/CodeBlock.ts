export const CODE_BLOCK_REG = /^```(\S*?)\s([\s\S]*?)```(\n?)/;

const renderer = (rawStr: string): string => {
  const parsedStr = rawStr.replace(CODE_BLOCK_REG, "<pre lang='$1'>\n$2</pre>$3");
  return parsedStr;
};

export default {
  name: "code block",
  regex: CODE_BLOCK_REG,
  renderer,
};
