import { inlineElementParserList } from ".";
import { marked } from "..";
import { matcher } from "../matcher";

export const DONE_LIST_REG = /^- \[[xX]\] ([^\n]+)/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, DONE_LIST_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [], inlineElementParserList);
  return (
    <p className="li-container">
      <span className="todo-block done" data-value="DONE">
        ✓
      </span>
      <span>{parsedContent}</span>
    </p>
  );
};

export default {
  name: "done list",
  regexp: DONE_LIST_REG,
  renderer,
};
