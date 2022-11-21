import { escape } from "lodash";
import { renderWithHighlightWord } from "./utils";

export const BLOCKQUOTE_REG = /^>\s+(.+)(\n?)/;

const renderer = (rawStr: string, highlightWord: string | undefined): string => {
  const matchResult = rawStr.match(BLOCKQUOTE_REG);
  if (!matchResult) {
    return rawStr;
  }

  const result = renderWithHighlightWord(escape(matchResult[1]), highlightWord);

  return `<blockquote>${result}</blockquote>${matchResult[2]}`;
};

export default {
  name: "blockqoute",
  regex: BLOCKQUOTE_REG,
  renderer,
};
