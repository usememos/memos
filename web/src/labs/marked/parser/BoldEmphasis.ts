import { escape } from "lodash";
import { marked } from "..";
import Link from "./Link";

export const BOLD_EMPHASIS_REG = /\*\*\*(.+?)\*\*\*/;

const matcher = (rawStr: string) => {
  const matchResult = rawStr.match(BOLD_EMPHASIS_REG);
  return matchResult;
};

const renderer = (rawStr: string): string => {
  const matchResult = matcher(rawStr);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(escape(matchResult[1]), [], [Link]);
  return `<strong><em>${parsedContent}</em></strong>`;
};

export default {
  name: "bold emphasis",
  regex: BOLD_EMPHASIS_REG,
  matcher,
  renderer,
};
