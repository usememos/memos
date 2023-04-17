import type { Parser } from "./Parser";
import CodeBlock from "./CodeBlock";
import TodoList, { TodoListNonInteractive } from "./TodoList";
import DoneList from "./DoneList";
import OrderedList, { OrderedListNonInteractive } from "./OrderedList";
import UnorderedList, { UnorderedListNonInteractive } from "./UnorderedList";
import Paragraph, { ParagraphNonInteractive } from "./Paragraph";
import Br from "./Br";
import Tag from "./Tag";
import Image from "./Image";
import Link, { LinkNonInteractive } from "./Link";
import Bold, { BoldNonInteractive } from "./Bold";
import Emphasis, { EmphasisNonInteractive } from "./Emphasis";
import PlainLink, { PlainLinkNonInteractive } from "./PlainLink";
import InlineCode from "./InlineCode";
import PlainText from "./PlainText";
import BoldEmphasis, { BoldEmphasisNonInteractive } from "./BoldEmphasis";
import Blockquote, { BlockquoteNonInteractive } from "./Blockquote";
import HorizontalRules from "./HorizontalRules";
import Strikethrough from "./Strikethrough";
import Heading, { HeadingNonInteractive } from "./Heading";
import MemoRef, { MemoRefNonInteractive } from "./MemoRef";

export { TAG_REG } from "./Tag";
export { LINK_REG } from "./Link";

// The order determines the order of execution.
export const blockElementParserList: Parser[] = [
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

export const inlineElementParserList: Parser[] = [
  Image,
  BoldEmphasis,
  Bold,
  Emphasis,
  Link,
  MemoRef,
  InlineCode,
  PlainLink,
  Strikethrough,
  Tag,
  PlainText,
];

export const blockElementParserListNonInteractive: Parser[] = [
  Br,
  CodeBlock,
  BlockquoteNonInteractive,
  HeadingNonInteractive,
  TodoListNonInteractive,
  OrderedListNonInteractive,
  UnorderedListNonInteractive,
  HorizontalRules,
  ParagraphNonInteractive,
];

export const inlineElementParserListNonInteractive: Parser[] = [
  Image,
  BoldEmphasisNonInteractive,
  BoldNonInteractive,
  EmphasisNonInteractive,
  LinkNonInteractive,
  MemoRefNonInteractive,
  PlainLinkNonInteractive,
  InlineCode,
  Strikethrough,
  Tag,
  PlainText,
];
