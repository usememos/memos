import { marked } from "..";
import { matcher } from "../matcher";
import Link from "./Link";
import PlainText from "./PlainText";

export const BOLD_EMPHASIS_REG = /\*\*\*(.+?)\*\*\*/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, BOLD_EMPHASIS_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [], [Link, PlainText]);
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
