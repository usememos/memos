import { escape } from "lodash-es";
import Emphasis from "./Emphasis";
import Bold from "./Bold";
import { marked } from "..";
import InlineCode from "./InlineCode";

export const LINK_REG = /\[(.*?)\]\((.+?)\)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(LINK_REG);
  if (!matchResult) {
    return rawStr;
  }
  const parsedContent = marked(matchResult[1], [], [InlineCode, Emphasis, Bold]);
  return `<a class='link' target='_blank' rel='noreferrer' href='${escape(matchResult[2])}'>${parsedContent}</a>`;
};

export default {
  name: "link",
  regex: LINK_REG,
  renderer,
};
