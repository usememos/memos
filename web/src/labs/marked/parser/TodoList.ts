import { inlineElementParserList } from ".";
import { marked } from "..";

export const TODO_LIST_REG = /^- \[ \] ([^\n]+)/;

const matcher = (rawStr: string) => {
  const matchResult = rawStr.match(TODO_LIST_REG);
  return matchResult;
};

const renderer = (rawStr: string): string => {
  const matchResult = matcher(rawStr);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [], inlineElementParserList);
  return `<p class='li-container'><span class='todo-block todo' data-value='TODO'></span><span>${parsedContent}</span></p>`;
};

export default {
  name: "todo list",
  regex: TODO_LIST_REG,
  matcher,
  renderer,
};
