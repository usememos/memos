import { marked } from "..";
import { matcher } from "../matcher";
import Link from "./Link";
import PlainText from "./PlainText";
import Mark from "./Mark";

export const BOLD_REG = /\*\*(.+?)\*\*/;

const renderer = (rawStr: string, highlightWord?: string) => {
  const matchResult = matcher(rawStr, BOLD_REG);
  if (!matchResult) {
    return rawStr;
  }
  let parsedContent;
  if (highlightWord) {
    parsedContent = marked(matchResult[1], highlightWord, [], [Mark, Link, PlainText]);
  } else {
    parsedContent = marked(matchResult[1], highlightWord, [], [Link, PlainText]);
  }
  return <strong>{parsedContent}</strong>;
};

export default {
  name: "bold",
  regexp: BOLD_REG,
  renderer,
};
