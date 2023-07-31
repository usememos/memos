import { marked } from "..";
import { matcher } from "../matcher";
import Bold from "./Bold";
import BoldEmphasis from "./BoldEmphasis";
import Emphasis from "./Emphasis";
import InlineCode from "./InlineCode";
import PlainText from "./PlainText";

export const LINK_REG = /\[([^\]]+)\]\(([^)]+)\)/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, LINK_REG);
  if (!matchResult) {
    return rawStr;
  }
  const parsedContent = marked(matchResult[1], [], [InlineCode, BoldEmphasis, Emphasis, Bold, PlainText]);
  return (
    <a className="link" target="_blank" href={matchResult[2]}>
      {parsedContent}
    </a>
  );
};

export default {
  name: "link",
  regexp: LINK_REG,
  renderer,
};
