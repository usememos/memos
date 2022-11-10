import { escape } from "lodash-es";

export const PLAIN_TEXT_REG = /(.+)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(PLAIN_TEXT_REG);
  if (!matchResult) {
    return rawStr;
  }

  return `${escape(matchResult[1])}`;
};

export default {
  name: "plain text",
  regex: PLAIN_TEXT_REG,
  renderer,
};
