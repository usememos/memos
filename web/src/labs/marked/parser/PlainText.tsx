import { escape } from "lodash-es";
import { matcher } from "../matcher";

export const PLAIN_TEXT_REG = /(.+)/;

const renderer = (rawStr: string): string => {
  const matchResult = matcher(rawStr, PLAIN_TEXT_REG);
  if (!matchResult) {
    return rawStr;
  }

  return `${escape(matchResult[1])}`;
};

export default {
  name: "plain text",
  regexp: PLAIN_TEXT_REG,
  renderer,
};
