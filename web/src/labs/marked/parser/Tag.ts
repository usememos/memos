import { escape } from "lodash-es";
import { renderWithHighlightWord } from "./utils";

export const TAG_REG = /#([^\s#]+?) /;

const renderer = (rawStr: string, highlightWord: string | undefined): string => {
  const matchResult = rawStr.match(TAG_REG);
  if (!matchResult) {
    return rawStr;
  }

  return `<span class='tag-span'>#${renderWithHighlightWord(escape(matchResult[1]), highlightWord)}</span> `;
};

export default {
  name: "tag",
  regex: TAG_REG,
  renderer,
};
