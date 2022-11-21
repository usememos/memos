import { marked } from "..";
import Link from "./Link";
import { renderWithHighlightWord } from "./utils";

export const EMPHASIS_REG = /\*(.+?)\*/;

const renderer = (rawStr: string, highlightWord: string | undefined): string => {
  const matchResult = rawStr.match(EMPHASIS_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], highlightWord, [], [Link]);
  return `<em>${renderWithHighlightWord(parsedContent, highlightWord)}</em>`;
};

export default {
  name: "emphasis",
  regex: EMPHASIS_REG,
  renderer,
};
