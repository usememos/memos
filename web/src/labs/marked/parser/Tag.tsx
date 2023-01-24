import { matcher } from "../matcher";
import { marked } from "../index";
import Mark from "./Mark";

export const TAG_REG = /#([^\s#]+)/;

const renderer = (rawStr: string, highlightWord?: string) => {
  const matchResult = matcher(rawStr, TAG_REG);
  if (!matchResult) {
    return rawStr;
  }
  let parsedContent;
  if (highlightWord) {
    parsedContent = marked(matchResult[1], highlightWord, [], [Mark]);
  } else {
    parsedContent = matchResult[1];
  }
  return <span className="tag-span">#{parsedContent}</span>;
};

export default {
  name: "tag",
  regexp: TAG_REG,
  renderer,
};
