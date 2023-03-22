import { inlineElementParserList } from ".";
import { marked } from "..";
import { matcher } from "../matcher";

export const BLOCKQUOTE_REG = /^> ([^\n]+)/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, BLOCKQUOTE_REG);
  if (!matchResult) {
    return <>{rawStr}</>;
  }

  const parsedContent = marked(matchResult[1], [], inlineElementParserList);
  return <blockquote>{parsedContent}</blockquote>;
};

export default {
  name: "blockquote",
  regexp: BLOCKQUOTE_REG,
  renderer,
};
