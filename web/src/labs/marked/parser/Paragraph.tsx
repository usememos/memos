import { inlineElementParserList } from ".";
import { marked } from "..";

export const PARAGRAPH_REG = /^([^\n]+)/;

const renderer = (rawStr: string) => {
  const parsedContent = marked(rawStr, [], inlineElementParserList);
  return <p>{parsedContent}</p>;
};

export default {
  name: "paragraph",
  regexp: PARAGRAPH_REG,
  renderer,
};
