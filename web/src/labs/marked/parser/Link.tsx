import { escape } from "lodash-es";
import Emphasis from "./Emphasis";
import Bold from "./Bold";
import { marked } from "..";
import InlineCode from "./InlineCode";
import BoldEmphasis from "./BoldEmphasis";
import PlainText from "./PlainText";
import { matcher } from "../matcher";

export const LINK_REG = /\[(.*?)\]\((.+?)\)+/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, LINK_REG);
  if (!matchResult) {
    return rawStr;
  }
  const parsedContent = marked(matchResult[1], [], [InlineCode, BoldEmphasis, Emphasis, Bold, PlainText]);
  return (
    <a className="link" target="_blank" rel="noreferrer" href={escape(matchResult[2])}>
      {parsedContent}
    </a>
  );
};

export default {
  name: "link",
  regexp: LINK_REG,
  renderer,
};
