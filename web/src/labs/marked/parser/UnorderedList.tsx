import { inlineElementParserList } from ".";
import { marked } from "..";
import { matcher } from "../matcher";
import Image from "./Image";
import BoldEmphasis from "./BoldEmphasis";
import Bold from "./Bold";
import Emphasis from "./Emphasis";
import Link from "./Link";
import InlineCode from "./InlineCode";
import PlainLink from "./PlainLink";
import Strikethrough from "./Strikethrough";
import Tag from "./Tag";
import PlainText from "./PlainText";

export const UNORDERED_LIST_REG = /^( *)[*-] ([^\n]+)/;

const renderer = (rawStr: string, highlightWord?: string) => {
  const matchResult = matcher(rawStr, UNORDERED_LIST_REG);
  if (!matchResult) {
    return rawStr;
  }
  const space = matchResult[1];
  let parsedContent;
  if (highlightWord) {
    parsedContent = marked(matchResult[2], highlightWord, [], inlineElementParserList);
  } else {
    parsedContent = marked(
      matchResult[2],
      highlightWord,
      [],
      [Image, BoldEmphasis, Bold, Emphasis, Link, InlineCode, PlainLink, Strikethrough, Tag, PlainText]
    );
  }
  return (
    <p className="li-container">
      <span className="whitespace-pre">{space}</span>
      <span className="ul-block">•</span>
      <span>{parsedContent}</span>
    </p>
  );
};

export default {
  name: "unordered list",
  regexp: UNORDERED_LIST_REG,
  renderer,
};
