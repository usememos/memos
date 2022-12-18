import { escape } from "lodash-es";
import { inlineElementParserList } from ".";
import { marked } from "..";

export const TODO_LIST_REG = /^- \[ \] (.+)(\n?)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(TODO_LIST_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [], inlineElementParserList);
  return `<p class='li-container'><span class='todo-block todo' data-value='TODO'></span><span>${parsedContent}</span></p>${escape(
    matchResult[2]
  )}`;
};

export default {
  name: "todo list",
  regex: TODO_LIST_REG,
  renderer,
};
