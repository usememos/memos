import { marked } from "..";
import Link from "./Link";

export const BOLD_REG = /\*\*(.+?)\*\*/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(BOLD_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [], [Link]);
  return `<strong>${parsedContent}</strong>`;
};

export default {
  name: "bold",
  regex: BOLD_REG,
  renderer,
};
