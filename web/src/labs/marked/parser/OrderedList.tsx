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

export const ORDERED_LIST_REG = /^( *)(\d+)\. (.+)/;

const renderer = (rawStr: string, highlightWord?: string) => {
  const matchResult = matcher(rawStr, ORDERED_LIST_REG);
  if (!matchResult) {
    return rawStr;
  }
  const space = matchResult[1];
  let parsedContent;
  if (highlightWord) {
    parsedContent = marked(matchResult[3], highlightWord, [], inlineElementParserList);
  } else {
    parsedContent = marked(
      matchResult[3],
      highlightWord,
      [],
      [Image, BoldEmphasis, Bold, Emphasis, Link, InlineCode, PlainLink, Strikethrough, Tag, PlainText]
    );
  }
  return (
    <p className="li-container">
      <span className="whitespace-pre">{space}</span>
      <span className="ol-block">{matchResult[2]}.</span>
      <span>{parsedContent}</span>
    </p>
  );
};

export default {
  name: "ordered list",
  regexp: ORDERED_LIST_REG,
  renderer,
};
