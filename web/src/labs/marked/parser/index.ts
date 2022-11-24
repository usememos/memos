import CodeBlock from "./CodeBlock";
import TodoList from "./TodoList";
import DoneList from "./DoneList";
import OrderedList from "./OrderedList";
import UnorderedList from "./UnorderedList";
import Paragraph from "./Paragraph";
import Tag from "./Tag";
import Image from "./Image";
import Link from "./Link";
import Bold from "./Bold";
import Emphasis from "./Emphasis";
import PlainLink from "./PlainLink";
import InlineCode from "./InlineCode";
import PlainText from "./PlainText";
import Table from "./Table";
import BoldEmphasis from "./BoldEmphasis";
import Blockquote from "./Blockquote";
import HorizontalRules from "./HorizontalRules";
import Strikethrough from "./Strikethrough";

export { CODE_BLOCK_REG } from "./CodeBlock";
export { TODO_LIST_REG } from "./TodoList";
export { DONE_LIST_REG } from "./DoneList";
export { TAG_REG } from "./Tag";
export { IMAGE_REG } from "./Image";
export { LINK_REG } from "./Link";
export { TABLE_REG } from "./Table";
export { HORIZONTAL_RULES_REG } from "./HorizontalRules";

// The order determines the order of execution.
export const blockElementParserList = [
  HorizontalRules,
  Table,
  CodeBlock,
  Blockquote,
  TodoList,
  DoneList,
  OrderedList,
  UnorderedList,
  Paragraph,
];
export const inlineElementParserList = [Image, BoldEmphasis, Bold, Emphasis, Link, InlineCode, PlainLink, Strikethrough, Tag, PlainText];
export const parserList = [...blockElementParserList, ...inlineElementParserList];
