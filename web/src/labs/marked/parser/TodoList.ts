import { inlineElementParserList } from ".";
import { marked } from "..";

export const TODO_LIST_REG = /^- \[ \] ([\S ]+)(\n?)/;

const match = (rawStr: string): number => {
  const matchResult = rawStr.match(TODO_LIST_REG);
  if (!matchResult) {
    return 0;
  }

  const matchStr = matchResult[0];
  return matchStr.length;
};

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(TODO_LIST_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], inlineElementParserList);
  return `<p><span class='todo-block todo' data-value='TODO'></span>${parsedContent}</p>${matchResult[2]}`;
};

export default {
  name: "todo list",
  regex: TODO_LIST_REG,
  match,
  renderer,
};
