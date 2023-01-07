import { inlineElementParserList } from ".";
import { marked } from "..";
import { matcher } from "../matcher";

export const UNORDERED_LIST_REG = /^[*-] ([^\n]+)/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, UNORDERED_LIST_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [], inlineElementParserList);
  return (
    <p className="li-container">
      <span className="ul-block">•</span>
      <span>{parsedContent}</span>
    </p>
  );
};

export default {
  name: "unordered list",
  regexp: UNORDERED_LIST_REG,
  renderer,
};
