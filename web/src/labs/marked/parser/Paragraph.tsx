import { inlineElementParserList } from ".";
import { marked } from "..";
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

export const PARAGRAPH_REG = /^([^\n]+)/;

const renderer = (rawStr: string, highlightWord?: string) => {
  let parsedContent;
  if (highlightWord) {
    parsedContent = marked(rawStr, highlightWord, [], inlineElementParserList);
  } else {
    parsedContent = marked(
      rawStr,
      highlightWord,
      [],
      [Image, BoldEmphasis, Bold, Emphasis, Link, InlineCode, PlainLink, Strikethrough, Tag, PlainText]
    );
  }
  return <p>{parsedContent}</p>;
};

export default {
  name: "paragraph",
  regexp: PARAGRAPH_REG,
  renderer,
};
