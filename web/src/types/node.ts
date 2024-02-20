/* eslint-disable */

export const protobufPackage = "gomark.node.v1";

export enum NodeType {
  NODE_UNSPECIFIED = "NODE_UNSPECIFIED",
  LINE_BREAK = "LINE_BREAK",
  PARAGRAPH = "PARAGRAPH",
  CODE_BLOCK = "CODE_BLOCK",
  HEADING = "HEADING",
  HORIZONTAL_RULE = "HORIZONTAL_RULE",
  BLOCKQUOTE = "BLOCKQUOTE",
  ORDERED_LIST = "ORDERED_LIST",
  UNORDERED_LIST = "UNORDERED_LIST",
  TASK_LIST = "TASK_LIST",
  MATH_BLOCK = "MATH_BLOCK",
  TABLE = "TABLE",
  EMBEDDED_CONTENT = "EMBEDDED_CONTENT",
  TEXT = "TEXT",
  BOLD = "BOLD",
  ITALIC = "ITALIC",
  BOLD_ITALIC = "BOLD_ITALIC",
  CODE = "CODE",
  IMAGE = "IMAGE",
  LINK = "LINK",
  AUTO_LINK = "AUTO_LINK",
  TAG = "TAG",
  STRIKETHROUGH = "STRIKETHROUGH",
  ESCAPING_CHARACTER = "ESCAPING_CHARACTER",
  MATH = "MATH",
  HIGHLIGHT = "HIGHLIGHT",
  SUBSCRIPT = "SUBSCRIPT",
  SUPERSCRIPT = "SUPERSCRIPT",
  REFERENCED_CONTENT = "REFERENCED_CONTENT",
  SPOILER = "SPOILER",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export interface Node {
  type: NodeType;
  lineBreakNode?: LineBreakNode | undefined;
  paragraphNode?: ParagraphNode | undefined;
  codeBlockNode?: CodeBlockNode | undefined;
  headingNode?: HeadingNode | undefined;
  horizontalRuleNode?: HorizontalRuleNode | undefined;
  blockquoteNode?: BlockquoteNode | undefined;
  orderedListNode?: OrderedListNode | undefined;
  unorderedListNode?: UnorderedListNode | undefined;
  taskListNode?: TaskListNode | undefined;
  mathBlockNode?: MathBlockNode | undefined;
  tableNode?: TableNode | undefined;
  embeddedContentNode?: EmbeddedContentNode | undefined;
  textNode?: TextNode | undefined;
  boldNode?: BoldNode | undefined;
  italicNode?: ItalicNode | undefined;
  boldItalicNode?: BoldItalicNode | undefined;
  codeNode?: CodeNode | undefined;
  imageNode?: ImageNode | undefined;
  linkNode?: LinkNode | undefined;
  autoLinkNode?: AutoLinkNode | undefined;
  tagNode?: TagNode | undefined;
  strikethroughNode?: StrikethroughNode | undefined;
  escapingCharacterNode?: EscapingCharacterNode | undefined;
  mathNode?: MathNode | undefined;
  highlightNode?: HighlightNode | undefined;
  subscriptNode?: SubscriptNode | undefined;
  superscriptNode?: SuperscriptNode | undefined;
  referencedContentNode?: ReferencedContentNode | undefined;
  spoilerNode?: SpoilerNode | undefined;
}

export interface LineBreakNode {
}

export interface ParagraphNode {
  children: Node[];
}

export interface CodeBlockNode {
  language: string;
  content: string;
}

export interface HeadingNode {
  level: number;
  children: Node[];
}

export interface HorizontalRuleNode {
  symbol: string;
}

export interface BlockquoteNode {
  children: Node[];
}

export interface OrderedListNode {
  number: string;
  indent: number;
  children: Node[];
}

export interface UnorderedListNode {
  symbol: string;
  indent: number;
  children: Node[];
}

export interface TaskListNode {
  symbol: string;
  indent: number;
  complete: boolean;
  children: Node[];
}

export interface MathBlockNode {
  content: string;
}

export interface TableNode {
  header: string[];
  delimiter: string[];
  rows: TableNode_Row[];
}

export interface TableNode_Row {
  cells: string[];
}

export interface EmbeddedContentNode {
  resourceName: string;
  params: string;
}

export interface TextNode {
  content: string;
}

export interface BoldNode {
  symbol: string;
  children: Node[];
}

export interface ItalicNode {
  symbol: string;
  content: string;
}

export interface BoldItalicNode {
  symbol: string;
  content: string;
}

export interface CodeNode {
  content: string;
}

export interface ImageNode {
  altText: string;
  url: string;
}

export interface LinkNode {
  text: string;
  url: string;
}

export interface AutoLinkNode {
  url: string;
  isRawText: boolean;
}

export interface TagNode {
  content: string;
}

export interface StrikethroughNode {
  content: string;
}

export interface EscapingCharacterNode {
  symbol: string;
}

export interface MathNode {
  content: string;
}

export interface HighlightNode {
  content: string;
}

export interface SubscriptNode {
  content: string;
}

export interface SuperscriptNode {
  content: string;
}

export interface ReferencedContentNode {
  resourceName: string;
  params: string;
}

export interface SpoilerNode {
  content: string;
}
