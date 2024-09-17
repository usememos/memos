import {
  AutoLinkNode,
  BlockquoteNode,
  BoldItalicNode,
  BoldNode,
  CodeBlockNode,
  CodeNode,
  EmbeddedContentNode,
  EscapingCharacterNode,
  HeadingNode,
  HighlightNode,
  HorizontalRuleNode,
  HTMLElementNode,
  ImageNode,
  ItalicNode,
  LinkNode,
  ListNode,
  MathBlockNode,
  MathNode,
  Node,
  NodeType,
  OrderedListItemNode,
  ParagraphNode,
  ReferencedContentNode,
  SpoilerNode,
  StrikethroughNode,
  SubscriptNode,
  SuperscriptNode,
  TableNode,
  TagNode,
  TaskListItemNode,
  TextNode,
  UnorderedListItemNode,
} from "@/types/proto/api/v1/markdown_service";
import Blockquote from "./Blockquote";
import Bold from "./Bold";
import BoldItalic from "./BoldItalic";
import Code from "./Code";
import CodeBlock from "./CodeBlock";
import EmbeddedContent from "./EmbeddedContent";
import EscapingCharacter from "./EscapingCharacter";
import HTMLElement from "./HTMLElement";
import Heading from "./Heading";
import Highlight from "./Highlight";
import HorizontalRule from "./HorizontalRule";
import Image from "./Image";
import Italic from "./Italic";
import LineBreak from "./LineBreak";
import Link from "./Link";
import List from "./List";
import Math from "./Math";
import OrderedListItem from "./OrderedListItem";
import Paragraph from "./Paragraph";
import ReferencedContent from "./ReferencedContent";
import Spoiler from "./Spoiler";
import Strikethrough from "./Strikethrough";
import Subscript from "./Subscript";
import Superscript from "./Superscript";
import Table from "./Table";
import Tag from "./Tag";
import TaskListItem from "./TaskListItem";
import Text from "./Text";
import UnorderedListItem from "./UnorderedListItem";

interface Props {
  index: string;
  node: Node;
}

const Renderer: React.FC<Props> = ({ index, node }: Props) => {
  switch (node.type) {
    case NodeType.LINE_BREAK:
      return <LineBreak index={index} />;
    case NodeType.PARAGRAPH:
      return <Paragraph index={index} {...(node.paragraphNode as ParagraphNode)} />;
    case NodeType.CODE_BLOCK:
      return <CodeBlock index={index} {...(node.codeBlockNode as CodeBlockNode)} />;
    case NodeType.HEADING:
      return <Heading index={index} {...(node.headingNode as HeadingNode)} />;
    case NodeType.HORIZONTAL_RULE:
      return <HorizontalRule index={index} {...(node.horizontalRuleNode as HorizontalRuleNode)} />;
    case NodeType.BLOCKQUOTE:
      return <Blockquote index={index} {...(node.blockquoteNode as BlockquoteNode)} />;
    case NodeType.LIST:
      return <List index={index} {...(node.listNode as ListNode)} />;
    case NodeType.ORDERED_LIST_ITEM:
      return <OrderedListItem index={index} {...(node.orderedListItemNode as OrderedListItemNode)} />;
    case NodeType.UNORDERED_LIST_ITEM:
      return <UnorderedListItem {...(node.unorderedListItemNode as UnorderedListItemNode)} />;
    case NodeType.TASK_LIST_ITEM:
      return <TaskListItem index={index} node={node} {...(node.taskListItemNode as TaskListItemNode)} />;
    case NodeType.MATH_BLOCK:
      return <Math {...(node.mathBlockNode as MathBlockNode)} block={true} />;
    case NodeType.TABLE:
      return <Table index={index} {...(node.tableNode as TableNode)} />;
    case NodeType.EMBEDDED_CONTENT:
      return <EmbeddedContent {...(node.embeddedContentNode as EmbeddedContentNode)} />;
    case NodeType.TEXT:
      return <Text {...(node.textNode as TextNode)} />;
    case NodeType.BOLD:
      return <Bold {...(node.boldNode as BoldNode)} />;
    case NodeType.ITALIC:
      return <Italic {...(node.italicNode as ItalicNode)} />;
    case NodeType.BOLD_ITALIC:
      return <BoldItalic {...(node.boldItalicNode as BoldItalicNode)} />;
    case NodeType.CODE:
      return <Code {...(node.codeNode as CodeNode)} />;
    case NodeType.IMAGE:
      return <Image {...(node.imageNode as ImageNode)} />;
    case NodeType.LINK:
      return <Link {...(node.linkNode as LinkNode)} />;
    case NodeType.AUTO_LINK:
      return <Link {...(node.autoLinkNode as AutoLinkNode)} />;
    case NodeType.TAG:
      return <Tag {...(node.tagNode as TagNode)} />;
    case NodeType.STRIKETHROUGH:
      return <Strikethrough {...(node.strikethroughNode as StrikethroughNode)} />;
    case NodeType.MATH:
      return <Math {...(node.mathNode as MathNode)} />;
    case NodeType.HIGHLIGHT:
      return <Highlight {...(node.highlightNode as HighlightNode)} />;
    case NodeType.ESCAPING_CHARACTER:
      return <EscapingCharacter {...(node.escapingCharacterNode as EscapingCharacterNode)} />;
    case NodeType.SUBSCRIPT:
      return <Subscript {...(node.subscriptNode as SubscriptNode)} />;
    case NodeType.SUPERSCRIPT:
      return <Superscript {...(node.superscriptNode as SuperscriptNode)} />;
    case NodeType.REFERENCED_CONTENT:
      return <ReferencedContent {...(node.referencedContentNode as ReferencedContentNode)} />;
    case NodeType.SPOILER:
      return <Spoiler {...(node.spoilerNode as SpoilerNode)} />;
    case NodeType.HTML_ELEMENT:
      return <HTMLElement {...(node.htmlElementNode as HTMLElementNode)} />;
    default:
      return null;
  }
};

export default Renderer;
