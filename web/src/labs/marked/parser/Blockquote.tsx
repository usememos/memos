import { matcher } from "../matcher";
import { marked } from "../index";
import Mark from "./Mark";

export const BLOCKQUOTE_REG = /^> ([^\n]+)/;

const renderer = (rawStr: string, highlightWord?: string) => {
  const matchResult = matcher(rawStr, BLOCKQUOTE_REG);
  if (!matchResult) {
    return <>{rawStr}</>;
  }
  let parsedContent;
  if (highlightWord) {
    parsedContent = marked(rawStr, highlightWord, [], [Mark]);
  } else {
    parsedContent = marked(rawStr, highlightWord, [], []);
  }
  return <blockquote>{parsedContent}</blockquote>;
};

export default {
  name: "blockquote",
  regexp: BLOCKQUOTE_REG,
  renderer,
};
