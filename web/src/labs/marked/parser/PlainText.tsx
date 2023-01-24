import { matcher } from "../matcher";

export const PLAIN_TEXT_REG = /(.+)/;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const renderer = (rawStr: string, highlightWord?: string) => {
  const matchResult = matcher(rawStr, PLAIN_TEXT_REG);
  if (!matchResult) {
    return rawStr;
  }

  return matchResult[1];
};

export default {
  name: "plain text",
  regexp: PLAIN_TEXT_REG,
  renderer,
};
