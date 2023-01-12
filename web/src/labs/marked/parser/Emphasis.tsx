import { marked } from "..";
import { matcher } from "../matcher";
import Link from "./Link";
import PlainLink from "./PlainLink";
import PlainText from "./PlainText";

export const EMPHASIS_REG = /\*(.+?)\*/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, EMPHASIS_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [], [Link, PlainLink, PlainText]);
  return <em>{parsedContent}</em>;
};

export default {
  name: "emphasis",
  regexp: EMPHASIS_REG,
  renderer,
};
