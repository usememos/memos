import { marked } from "..";
import Link from "./Link";
import { renderWithHighlightWord } from "./utils";

export const BOLD_EMPHASIS_REG = /\*\*\*(.+?)\*\*\*/;

const renderer = (rawStr: string, highlightWord: string | undefined): string => {
  const matchResult = rawStr.match(BOLD_EMPHASIS_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], highlightWord, [], [Link]);
  return `<strong><em>${renderWithHighlightWord(parsedContent, highlightWord)}</em></strong>`;
};

export default {
  name: "bold emphasis",
  regex: BOLD_EMPHASIS_REG,
  renderer,
};
