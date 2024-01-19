import {
  AutoLinkNode,
  BlockquoteNode,
  BoldItalicNode,
  BoldNode,
  CodeBlockNode,
  CodeNode,
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
  StrikethroughNode,
  SubscriptNode,
  SuperscriptNode,
  TableNode,
  TagNode,
  TaskListNode,
  TextNode,
  UnorderedListNode,
} from "@/types/proto/api/v2/markdown_service";
import Blockquote from "./Blockquote";
import Bold from "./Bold";
import BoldItalic from "./BoldItalic";
import Code from "./Code";
import CodeBlock from "./CodeBlock";
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
      return <Paragraph index={index} {...(node.paragraphNode as ParagraphNode)} />;
    case NodeType.CODE_BLOCK:
      return <CodeBlock index={index} {...(node.codeBlockNode as CodeBlockNode)} />;
    case NodeType.HEADING:
      return <Heading index={index} {...(node.headingNode as HeadingNode)} />;
    case NodeType.HORIZONTAL_RULE:
      return <HorizontalRule index={index} {...(node.horizontalRuleNode as HorizontalRuleNode)} />;
    case NodeType.BLOCKQUOTE:
      return <Blockquote index={index} {...(node.blockquoteNode as BlockquoteNode)} />;
    case NodeType.ORDERED_LIST:
      return <OrderedList index={index} {...(node.orderedListNode as OrderedListNode)} />;
    case NodeType.UNORDERED_LIST:
      return <UnorderedList {...(node.unorderedListNode as UnorderedListNode)} />;
    case NodeType.TASK_LIST:
      return <TaskList index={index} {...(node.taskListNode as TaskListNode)} />;
    case NodeType.MATH_BLOCK:
      return <Math {...(node.mathBlockNode as MathNode)} block={true} />;
    case NodeType.TABLE:
      return <Table {...(node.tableNode as TableNode)} />;
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
    default:
      return null;
  }
};

export default Renderer;
