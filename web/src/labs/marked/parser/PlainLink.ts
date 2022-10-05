import { escape } from "lodash-es";

export const PLAIN_LINK_REG = /(https?:\/\/[^ ]+)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(PLAIN_LINK_REG);
  if (!matchResult) {
    return rawStr;
  }

  return `<a class='link' target='_blank' rel='noreferrer' href='${escape(matchResult[1])}'>${escape(matchResult[1])}</a>`;
};

export default {
  name: "plain link",
  regex: PLAIN_LINK_REG,
  renderer,
};
