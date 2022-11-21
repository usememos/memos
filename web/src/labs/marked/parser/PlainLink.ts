import { escape } from "lodash-es";
import { renderWithHighlightWord } from "./utils";

export const PLAIN_LINK_REG = /(https?:\/\/[^ ]+)/;

const renderer = (rawStr: string, highlightWord: string | undefined): string => {
  const matchResult = rawStr.match(PLAIN_LINK_REG);
  if (!matchResult) {
    return rawStr;
  }

  return `<a class='link' target='_blank' rel='noreferrer' href='${escape(matchResult[1])}'>${renderWithHighlightWord(
    escape(matchResult[1]),
    highlightWord
  )}</a>`;
};

export default {
  name: "plain link",
  regex: PLAIN_LINK_REG,
  renderer,
};
