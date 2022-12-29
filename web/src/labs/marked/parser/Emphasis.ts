import { marked } from "..";
import Link from "./Link";

export const EMPHASIS_REG = /\*(.+?)\*/;

const matcher = (rawStr: string) => {
  const matchResult = rawStr.match(EMPHASIS_REG);
  return matchResult;
};

const renderer = (rawStr: string): string => {
  const matchResult = matcher(rawStr);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [], [Link]);
  return `<em>${parsedContent}</em>`;
};

export default {
  name: "emphasis",
  regex: EMPHASIS_REG,
  matcher,
  renderer,
};
