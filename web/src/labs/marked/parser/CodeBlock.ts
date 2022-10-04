import { escape } from "lodash-es";

export const CODE_BLOCK_REG = /^```(\S*?)\s([\s\S]*?)```(\n?)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(CODE_BLOCK_REG);
  if (!matchResult) {
    return rawStr;
  }

  return `<pre lang='${escape(matchResult[1])}'>\n${escape(matchResult[2])}</pre>${matchResult[3]}`;
};

export default {
  name: "code block",
  regex: CODE_BLOCK_REG,
  renderer,
};
