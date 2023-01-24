import { matcher } from "../matcher";
import { marked } from "../index";
import Mark from "./Mark";

export const STRIKETHROUGH_REG = /~~(.+?)~~/;

const renderer = (rawStr: string, highlightWord?: string) => {
  const matchResult = matcher(rawStr, STRIKETHROUGH_REG);
  if (!matchResult) {
    return rawStr;
  }
  let parsedContent;
  if (highlightWord) {
    parsedContent = marked(matchResult[1], highlightWord, [], [Mark]);
  } else {
    parsedContent = matchResult[1];
  }
  return <del>{parsedContent}</del>;
};

export default {
  name: "Strikethrough",
  regexp: STRIKETHROUGH_REG,
  renderer,
};
