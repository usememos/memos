import { marked } from "..";
import { matcher } from "../matcher";
import Link from "./Link";
import PlainLink from "./PlainLink";
import PlainText from "./PlainText";
import Mark from "./Mark";

export const EMPHASIS_REG = /\*(.+?)\*/;

const renderer = (rawStr: string, highlightWord?: string) => {
  const matchResult = matcher(rawStr, EMPHASIS_REG);
  if (!matchResult) {
    return rawStr;
  }
  let parsedContent;
  if (highlightWord) {
    parsedContent = marked(matchResult[1], highlightWord, [], [Mark, Link, PlainLink, PlainText]);
  } else {
    parsedContent = marked(matchResult[1], highlightWord, [], [Link, PlainLink, PlainText]);
  }
  return <em>{parsedContent}</em>;
};

export default {
  name: "emphasis",
  regexp: EMPHASIS_REG,
  renderer,
};
