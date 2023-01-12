import { inlineElementParserList } from ".";
import { marked } from "..";
import { matcher } from "../matcher";

export const UNORDERED_LIST_REG = /^( *)[*-] ([^\n]+)/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, UNORDERED_LIST_REG);
  if (!matchResult) {
    return rawStr;
  }
  const space = matchResult[1];
  const parsedContent = marked(matchResult[2], [], inlineElementParserList);
  return (
    <p className="li-container">
      <span className="whitespace-pre">{space}</span>
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
