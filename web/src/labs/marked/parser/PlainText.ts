import { escape } from "lodash-es";

export const PLAIN_TEXT_REG = /(.+)/;

const matcher = (rawStr: string) => {
  const matchResult = rawStr.match(PLAIN_TEXT_REG);
  return matchResult;
};

const renderer = (rawStr: string): string => {
  const matchResult = matcher(rawStr);
  if (!matchResult) {
    return rawStr;
  }

  return `${escape(matchResult[1])}`;
};

export default {
  name: "plain text",
  regex: PLAIN_TEXT_REG,
  matcher,
  renderer,
};
