import { marked } from "..";
import { matcher } from "../matcher";
import Link from "./Link";
import PlainText from "./PlainText";

export const BOLD_REG = /\*\*(.+?)\*\*/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, BOLD_REG);
  if (!matchResult) {
    return <>{rawStr}</>;
  }

  const parsedContent = marked(matchResult[1], [], [Link, PlainText]);
  return <strong>{parsedContent}</strong>;
};

export default {
  name: "bold",
  regexp: BOLD_REG,
  renderer,
};
