import CodeBlock from "./CodeBlock";
import TodoList from "./TodoList";
import DoneList from "./DoneList";
import OrderedList from "./OrderedList";
import UnorderedList from "./UnorderedList";
import Paragraph from "./Paragraph";
import Br from "./Br";
import Tag from "./Tag";
import Image from "./Image";
import Link from "./Link";
import Bold from "./Bold";
import Emphasis from "./Emphasis";
import PlainLink from "./PlainLink";
import InlineCode from "./InlineCode";
import PlainText from "./PlainText";
import BoldEmphasis from "./BoldEmphasis";
import Blockquote from "./Blockquote";
import HorizontalRules from "./HorizontalRules";
import Strikethrough from "./Strikethrough";
import Heading from "./Heading";

export { TAG_REG } from "./Tag";
export { LINK_REG } from "./Link";

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
