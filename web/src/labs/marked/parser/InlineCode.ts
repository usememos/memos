import { escape } from "lodash-es";
import { renderWithHighlightWord } from "./utils";

export const INLINE_CODE_REG = /`(.+?)`/;

const renderer = (rawStr: string, highlightWord: string | undefined): string => {
  const matchResult = rawStr.match(INLINE_CODE_REG);
  if (!matchResult) {
    return rawStr;
  }

  return `<code>${renderWithHighlightWord(escape(matchResult[1]), highlightWord)}</code>`;
};

export default {
  name: "inline code",
  regex: INLINE_CODE_REG,
  renderer,
};
