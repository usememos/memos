import { escape } from "lodash-es";
import Emphasis from "./Emphasis";
import Bold from "./Bold";
import { marked } from "..";
import InlineCode from "./InlineCode";
import BoldEmphasis from "./BoldEmphasis";

export const LINK_REG = /\[(.*?)\]\((.+?)\)+/;

const matcher = (rawStr: string) => {
  const matchResult = rawStr.match(LINK_REG);
  return matchResult;
};

const renderer = (rawStr: string): string => {
  const matchResult = matcher(rawStr);
  if (!matchResult) {
    return rawStr;
  }
  const parsedContent = marked(matchResult[1], [], [InlineCode, BoldEmphasis, Emphasis, Bold]);
  return `<a class='link' target='_blank' rel='noreferrer' href='${escape(matchResult[2])}'>${parsedContent}</a>`;
};

export default {
  name: "link",
  regex: LINK_REG,
  matcher,
  renderer,
};
