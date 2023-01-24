import { marked } from "..";
import { matcher } from "../matcher";
import Link from "./Link";
import PlainText from "./PlainText";
import Mark from "./Mark";

export const BOLD_EMPHASIS_REG = /\*\*\*(.+?)\*\*\*/;

const renderer = (rawStr: string, highlightWord?: string) => {
  const matchResult = matcher(rawStr, BOLD_EMPHASIS_REG);
  if (!matchResult) {
    return rawStr;
  }
  let parsedContent;
  if (highlightWord) {
    parsedContent = marked(matchResult[1], highlightWord, [], [Mark, Link, PlainText]);
  } else {
    parsedContent = marked(matchResult[1], highlightWord, [], [Link, PlainText]);
  }
  return (
    <strong>
      <em>{parsedContent}</em>
    </strong>
  );
};

export default {
  name: "bold emphasis",
  regexp: BOLD_EMPHASIS_REG,
  renderer,
};
