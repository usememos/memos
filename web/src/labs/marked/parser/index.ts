import Blockquote from "./Blockquote";
import Bold from "./Bold";
import BoldEmphasis from "./BoldEmphasis";
import Br from "./Br";
import CodeBlock from "./CodeBlock";
import DoneList from "./DoneList";
import Emphasis from "./Emphasis";
import Heading from "./Heading";
import HorizontalRules from "./HorizontalRules";
import Image from "./Image";
import InlineCode from "./InlineCode";
import Link from "./Link";
import OrderedList from "./OrderedList";
import Paragraph from "./Paragraph";
import PlainLink from "./PlainLink";
import PlainText from "./PlainText";
import Strikethrough from "./Strikethrough";
import Tag from "./Tag";
import TodoList from "./TodoList";
import UnorderedList from "./UnorderedList";

export { TAG_REG } from "./Tag";
export { LINK_REG } from "./Link";
export { PLAIN_LINK_REG } from "./PlainLink";

// The order determines the order of execution.
export const blockElementParserList = [
  Br,
  CodeBlock,
  Blockquote,
  Heading,
  TodoList,
  DoneList,
  OrderedList,
  UnorderedList,
  HorizontalRules,
  Paragraph,
];

export const inlineElementParserList = [Image, BoldEmphasis, Bold, Emphasis, Link, InlineCode, PlainLink, Strikethrough, Tag, PlainText];
