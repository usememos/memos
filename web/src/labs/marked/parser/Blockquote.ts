import { escape } from "lodash";

export const BLOCKQUOTE_REG = /^>\s+([\S ]+)(\n?)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(BLOCKQUOTE_REG);
  if (!matchResult) {
    return rawStr;
  }

  return `<blockquote>${escape(matchResult[1])}</blockquote>${matchResult[2]}`;
};

export default {
  name: "blockqoute",
  regex: BLOCKQUOTE_REG,
  renderer,
};
