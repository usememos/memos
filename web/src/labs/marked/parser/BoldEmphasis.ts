import { marked } from "..";
import Link from "./Link";

export const BOLD_EMPHASIS_REG = /\*\*\*([\S ]+?)\*\*\*/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(BOLD_EMPHASIS_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [], [Link]);
  return `<strong><em>${parsedContent}</em></strong>`;
};

export default {
  name: "bold emphasis",
  regex: BOLD_EMPHASIS_REG,
  renderer,
};
