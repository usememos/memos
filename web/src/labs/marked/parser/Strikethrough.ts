import { escape } from "lodash";

export const STRIKETHROUGH_REG = /~~(.+?)~~/;

const matcher = (rawStr: string) => {
  const matchResult = rawStr.match(STRIKETHROUGH_REG);
  return matchResult;
};

const renderer = (rawStr: string): string => {
  const matchResult = matcher(rawStr);
  if (!matchResult) {
    return rawStr;
  }

  return `<del>${escape(matchResult[1])}</del>`;
};

export default {
  name: "Strikethrough",
  regex: STRIKETHROUGH_REG,
  matcher,
  renderer,
};
