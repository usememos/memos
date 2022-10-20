import { marked } from "..";
import Bold from "./Bold";
import Link from "./Link";

export const EMPHASIS_REG = /\*([\S ]+?)\*/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(EMPHASIS_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [], [Bold, Link]);
  return `<em>${parsedContent}</em>`;
};

export default {
  name: "emphasis",
  regex: EMPHASIS_REG,
  renderer,
};
