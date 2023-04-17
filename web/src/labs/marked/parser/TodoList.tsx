import { inlineElementParserList, inlineElementParserListNonInteractive } from ".";
import { marked } from "..";
import { matcher } from "../matcher";
import { Parser } from "./Parser";

export const TODO_LIST_REG = /^( *)- \[ \] ([^\n]+)/;

// eslint-disable-next-line react/display-name
const renderer = (inlineParsers: Parser[]) => (rawStr: string) => {
  const matchResult = matcher(rawStr, TODO_LIST_REG);
  if (!matchResult) {
    return rawStr;
  }
  const space = matchResult[1];
  const parsedContent = marked(matchResult[2], [], inlineParsers);
  return (
    <p className="li-container">
      <span className="whitespace-pre">{space}</span>
      <span className="todo-block todo" data-value="TODO"></span>
      <span>{parsedContent}</span>
    </p>
  );
};

export default {
  name: "todo list",
  regexp: TODO_LIST_REG,
  renderer: () => renderer(inlineElementParserList),
};

export const TodoListNonInteractive = {
  name: "todo list non-interactive",
  regexp: TODO_LIST_REG,
  renderer: () => renderer(inlineElementParserListNonInteractive),
};
