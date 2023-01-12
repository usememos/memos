import { inlineElementParserList } from ".";
import { marked } from "..";
import { matcher } from "../matcher";

export const ORDERED_LIST_REG = /^( *)(\d+)\. (.+)/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, ORDERED_LIST_REG);
  if (!matchResult) {
    return rawStr;
  }
  const space = matchResult[1];
  const parsedContent = marked(matchResult[3], [], inlineElementParserList);
  return (
    <p className="li-container">
      <span className="whitespace-pre">{space}</span>
      <span className="ol-block">{matchResult[2]}.</span>
      <span>{parsedContent}</span>
    </p>
  );
};

export default {
  name: "ordered list",
  regexp: ORDERED_LIST_REG,
  renderer,
};
