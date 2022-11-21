import { marked } from "..";
import Link from "./Link";
import { renderWithHighlightWord } from "./utils";

export const BOLD_REG = /\*\*(.+?)\*\*/;

const renderer = (rawStr: string, highlightWord: string | undefined): string => {
  const matchResult = rawStr.match(BOLD_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], highlightWord, [], [Link]);
  return `<strong>${renderWithHighlightWord(parsedContent, highlightWord)}</strong>`;
};

export default {
  name: "bold",
  regex: BOLD_REG,
  renderer,
};
