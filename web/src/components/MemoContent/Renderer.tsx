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
  ImageNode,
  ItalicNode,
  LinkNode,
  MathNode,
  Node,
  NodeType,
  OrderedListNode,
  ParagraphNode,
  ReferencedContentNode,
  SpoilerNode,
  StrikethroughNode,
  SubscriptNode,
  SuperscriptNode,
  TableNode,
  TagNode,
  TaskListNode,
  TextNode,
  UnorderedListNode,
} from "@/types/node";
import Blockquote from "./Blockquote";
import Bold from "./Bold";
import BoldItalic from "./BoldItalic";
import Code from "./Code";
import CodeBlock from "./CodeBlock";
import EmbeddedContent from "./EmbeddedContent";
import EscapingCharacter from "./EscapingCharacter";
import Heading from "./Heading";
import Highlight from "./Highlight";
import HorizontalRule from "./HorizontalRule";
import Image from "./Image";
import Italic from "./Italic";
import LineBreak from "./LineBreak";
import Link from "./Link";
import Math from "./Math";
import OrderedList from "./OrderedList";
import Paragraph from "./Paragraph";
import ReferencedContent from "./ReferencedContent";
import Spoiler from "./Spoiler";
import Strikethrough from "./Strikethrough";
import Subscript from "./Subscript";
import Superscript from "./Superscript";
import Table from "./Table";
import Tag from "./Tag";
import TaskList from "./TaskList";
import Text from "./Text";
import UnorderedList from "./UnorderedList";

interface Props {
  index: string;
  node: Node;
}

const Renderer: React.FC<Props> = ({ index, node }: Props) => {
  switch (node.type) {
    case NodeType.LINE_BREAK:
      return <LineBreak index={index} />;
    case NodeType.PARAGRAPH:
      return <Paragraph index={index} {...(node.value as ParagraphNode)} />;
    case NodeType.CODE_BLOCK:
      return <CodeBlock index={index} {...(node.value as CodeBlockNode)} />;
    case NodeType.HEADING:
      return <Heading index={index} {...(node.value as HeadingNode)} />;
    case NodeType.HORIZONTAL_RULE:
      return <HorizontalRule index={index} {...(node.value as HorizontalRuleNode)} />;
    case NodeType.BLOCKQUOTE:
      return <Blockquote index={index} {...(node.value as BlockquoteNode)} />;
    case NodeType.ORDERED_LIST:
      return <OrderedList index={index} {...(node.value as OrderedListNode)} />;
    case NodeType.UNORDERED_LIST:
      return <UnorderedList {...(node.value as UnorderedListNode)} />;
    case NodeType.TASK_LIST:
      return <TaskList index={index} {...(node.value as TaskListNode)} />;
    case NodeType.MATH_BLOCK:
      return <Math {...(node.value as MathNode)} block={true} />;
    case NodeType.TABLE:
      return <Table {...(node.value as TableNode)} />;
    case NodeType.EMBEDDED_CONTENT:
      return <EmbeddedContent {...(node.value as EmbeddedContentNode)} />;
    case NodeType.TEXT:
      return <Text {...(node.value as TextNode)} />;
    case NodeType.BOLD:
      return <Bold {...(node.value as BoldNode)} />;
    case NodeType.ITALIC:
      return <Italic {...(node.value as ItalicNode)} />;
    case NodeType.BOLD_ITALIC:
      return <BoldItalic {...(node.value as BoldItalicNode)} />;
    case NodeType.CODE:
      return <Code {...(node.value as CodeNode)} />;
    case NodeType.IMAGE:
      return <Image {...(node.value as ImageNode)} />;
    case NodeType.LINK:
      return <Link {...(node.value as LinkNode)} />;
    case NodeType.AUTO_LINK:
      return <Link {...(node.value as AutoLinkNode)} />;
    case NodeType.TAG:
      return <Tag {...(node.value as TagNode)} />;
    case NodeType.STRIKETHROUGH:
      return <Strikethrough {...(node.value as StrikethroughNode)} />;
    case NodeType.MATH:
      return <Math {...(node.value as MathNode)} />;
    case NodeType.HIGHLIGHT:
      return <Highlight {...(node.value as HighlightNode)} />;
    case NodeType.ESCAPING_CHARACTER:
      return <EscapingCharacter {...(node.value as EscapingCharacterNode)} />;
    case NodeType.SUBSCRIPT:
      return <Subscript {...(node.value as SubscriptNode)} />;
    case NodeType.SUPERSCRIPT:
      return <Superscript {...(node.value as SuperscriptNode)} />;
    case NodeType.REFERENCED_CONTENT:
      return <ReferencedContent {...(node.value as ReferencedContentNode)} />;
    case NodeType.SPOILER:
      return <Spoiler {...(node.value as SpoilerNode)} />;
    default:
      return null;
  }
};

export default Renderer;
