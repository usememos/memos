import { inlineElementParserList } from ".";
import { marked } from "..";
import { matcher } from "../matcher";

export const TODO_LIST_REG = /^- \[ \] ([^\n]+)/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, TODO_LIST_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [], inlineElementParserList);
  return (
    <p className="li-container">
      <span className="todo-block todo" data-value="TODO"></span>
      <span>{parsedContent}</span>
    </p>
  );
};

export default {
  name: "todo list",
  regexp: TODO_LIST_REG,
  renderer,
};
