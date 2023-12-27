import {
  AutoLinkNode,
  BlockquoteNode,
  BoldItalicNode,
  BoldNode,
  CodeBlockNode,
  CodeNode,
  EscapingCharacterNode,
  HeadingNode,
  HorizontalRuleNode,
  ImageNode,
  ItalicNode,
  LinkNode,
  Node,
  NodeType,
  OrderedListNode,
  ParagraphNode,
  StrikethroughNode,
  TagNode,
  TaskListNode,
  TextNode,
  UnorderedListNode,
} from "@/types/proto/api/v2/markdown_service";
import AutoLink from "./AutoLink";
import Blockquote from "./Blockquote";
import Bold from "./Bold";
import BoldItalic from "./BoldItalic";
import Code from "./Code";
import CodeBlock from "./CodeBlock";
import EscapingCharacter from "./EscapingCharacter";
import Heading from "./Heading";
import HorizontalRule from "./HorizontalRule";
import Image from "./Image";
import Italic from "./Italic";
import LineBreak from "./LineBreak";
import Link from "./Link";
import OrderedList from "./OrderedList";
import Paragraph from "./Paragraph";
import Strikethrough from "./Strikethrough";
import Tag from "./Tag";
import TaskList from "./TaskList";
import Text from "./Text";
import UnorderedList from "./UnorderedList";

interface Props {
  node: Node;
}

const Renderer: React.FC<Props> = ({ node }: Props) => {
  switch (node.type) {
    case NodeType.LINE_BREAK:
      return <LineBreak />;
    case NodeType.PARAGRAPH:
      return <Paragraph {...(node.paragraphNode as ParagraphNode)} />;
    case NodeType.CODE_BLOCK:
      return <CodeBlock {...(node.codeBlockNode as CodeBlockNode)} />;
    case NodeType.HEADING:
      return <Heading {...(node.headingNode as HeadingNode)} />;
    case NodeType.HORIZONTAL_RULE:
      return <HorizontalRule {...(node.horizontalRuleNode as HorizontalRuleNode)} />;
    case NodeType.BLOCKQUOTE:
      return <Blockquote {...(node.blockquoteNode as BlockquoteNode)} />;
    case NodeType.ORDERED_LIST:
      return <OrderedList {...(node.orderedListNode as OrderedListNode)} />;
    case NodeType.UNORDERED_LIST:
      return <UnorderedList {...(node.unorderedListNode as UnorderedListNode)} />;
    case NodeType.TASK_LIST:
      return <TaskList {...(node.taskListNode as TaskListNode)} />;
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
      return <AutoLink {...(node.autoLinkNode as AutoLinkNode)} />;
    case NodeType.TAG:
      return <Tag {...(node.tagNode as TagNode)} />;
    case NodeType.STRIKETHROUGH:
      return <Strikethrough {...(node.strikethroughNode as StrikethroughNode)} />;
    case NodeType.ESCAPING_CHARACTER:
      return <EscapingCharacter {...(node.escapingCharacterNode as EscapingCharacterNode)} />;
    default:
      return null;
  }
};

export default Renderer;
