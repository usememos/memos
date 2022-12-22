import { escape } from "lodash";

export const HEADING_REG = /^(#+) ([^\n]+)/;

const matcher = (rawStr: string) => {
  const matchResult = rawStr.match(HEADING_REG);
  return matchResult;
};

const renderer = (rawStr: string): string => {
  const matchResult = matcher(rawStr);
  if (!matchResult) {
    return rawStr;
  }

  const level = matchResult[1].length;
  return `<h${level}>${escape(matchResult[2])}</h${level}>`;
};

export default {
  name: "heading",
  regex: HEADING_REG,
  matcher,
  renderer,
};
