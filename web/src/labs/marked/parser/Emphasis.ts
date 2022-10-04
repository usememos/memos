import { marked } from "..";
import Link from "./Link";
import PlainLink from "./PlainLink";

export const EMPHASIS_REG = /\*([\S ]+)\*/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(EMPHASIS_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [Link, PlainLink]);
  return `<em>${parsedContent}</em>`;
};

export default {
  name: "emphasis",
  regex: EMPHASIS_REG,
  renderer,
};
