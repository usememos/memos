import { escape } from "lodash-es";
import Emphasis from "./Emphasis";
import Bold from "./Bold";
import { marked } from "..";
import InlineCode from "./InlineCode";
import BoldEmphasis from "./BoldEmphasis";
import { renderWithHighlightWord } from "./utils";

export const LINK_REG = /\[(.*?)\]\((.+?)\)+/;

const renderer = (rawStr: string, highlightWord: string | undefined): string => {
  const matchResult = rawStr.match(LINK_REG);
  if (!matchResult) {
    return rawStr;
  }
  const parsedContent = marked(matchResult[1], highlightWord, [], [InlineCode, BoldEmphasis, Emphasis, Bold]);
  return `<a class='link' target='_blank' rel='noreferrer' href='${escape(matchResult[2])}'>${renderWithHighlightWord(
    parsedContent,
    highlightWord
  )}</a>`;
};

export default {
  name: "link",
  regex: LINK_REG,
  renderer,
};
