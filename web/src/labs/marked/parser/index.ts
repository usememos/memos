import CodeBlock from "./CodeBlock";
import TodoList from "./TodoList";
import DoneList from "./DoneList";
import OrderedList from "./OrderedList";
import UnorderedList from "./UnorderedList";
import Paragraph from "./Paragraph";
import Tag from "./Tag";
import Image from "./Image";
import Link from "./Link";
import Mark from "./Mark";
import Bold from "./Bold";
import Emphasis from "./Emphasis";
import PlainLink from "./PlainLink";
import InlineCode from "./InlineCode";

export { CODE_BLOCK_REG } from "./CodeBlock";
export { TODO_LIST_REG } from "./TodoList";
export { DONE_LIST_REG } from "./DoneList";
export { ORDERED_LIST_REG } from "./OrderedList";
export { UNORDERED_LIST_REG } from "./UnorderedList";
export { PARAGRAPH_REG } from "./Paragraph";
export { TAG_REG } from "./Tag";
export { IMAGE_REG } from "./Image";
export { LINK_REG } from "./Link";
export { MARK_REG } from "./Mark";
export { BOLD_REG } from "./Bold";
export { EMPHASIS_REG } from "./Emphasis";

// The order determines the order of execution.
export const blockElementParserList = [CodeBlock, TodoList, DoneList, OrderedList, UnorderedList, Paragraph];
export const inlineElementParserList = [Image, Mark, Link, Bold, Emphasis, InlineCode, PlainLink, Tag];
export const parserList = [...blockElementParserList, ...inlineElementParserList];
