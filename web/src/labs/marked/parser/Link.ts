import { escape } from "lodash-es";

export const LINK_REG = /\[(.*?)\]\((.+?)\)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(LINK_REG);
  if (!matchResult) {
    return rawStr;
  }

  return `<a class='link' target='_blank' rel='noreferrer' href='${escape(matchResult[2])}'>${escape(matchResult[1])}</a>`;
};

export default {
  name: "link",
  regex: LINK_REG,
  renderer,
};
