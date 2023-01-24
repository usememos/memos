import { matcher } from "../matcher";
import { marked } from "../index";
import Mark from "./Mark";

export const INLINE_CODE_REG = /`(.+?)`/;

const renderer = (rawStr: string, highlightWord?: string) => {
  const matchResult = matcher(rawStr, INLINE_CODE_REG);
  if (!matchResult) {
    return rawStr;
  }
  let parsedContent;
  if (highlightWord) {
    parsedContent = marked(matchResult[1], highlightWord, [], [Mark]);
  } else {
    parsedContent = matchResult[1];
  }
  return <code>{parsedContent}</code>;
};

export default {
  name: "inline code",
  regexp: INLINE_CODE_REG,
  renderer,
};
