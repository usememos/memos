import { escape } from "lodash";

export const BLOCKQUOTE_REG = /^> ([^\n]+)/;

const matcher = (rawStr: string) => {
  const matchResult = rawStr.match(BLOCKQUOTE_REG);
  return matchResult;
};

const renderer = (rawStr: string): string => {
  const matchResult = matcher(rawStr);
  if (!matchResult) {
    return rawStr;
  }

  return `<blockquote>${escape(matchResult[1])}</blockquote>`;
};

export default {
  name: "blockquote",
  regex: BLOCKQUOTE_REG,
  matcher,
  renderer,
};
