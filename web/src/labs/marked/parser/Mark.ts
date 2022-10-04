import { escape } from "lodash-es";

export const MARK_REG = /@\[([\S ]+?)\]\((\S+?)\)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(MARK_REG);
  if (!matchResult) {
    return rawStr;
  }

  return `<span class='memo-link-text' data-value='${escape(matchResult[2])}'>${escape(matchResult[1])}</span>`;
};

export default {
  name: "mark",
  regex: MARK_REG,
  renderer,
};
