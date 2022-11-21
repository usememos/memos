import { escape } from "lodash-es";
import { renderWithHighlightWord } from "./utils";

export const PLAIN_TEXT_REG = /(.+)/;

const renderer = (rawStr: string, highlightWord: string | undefined): string => {
  const matchResult = rawStr.match(PLAIN_TEXT_REG);
  if (!matchResult) {
    return rawStr;
  }

  return `${renderWithHighlightWord(escape(matchResult[1]), highlightWord)}`;
};

export default {
  name: "plain text",
  regex: PLAIN_TEXT_REG,
  renderer,
};
