/* eslint-disable */
import _m0 from "protobufjs/minimal";

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
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function nodeTypeFromJSON(object: any): NodeType {
  switch (object) {
    case 0:
    case "NODE_UNSPECIFIED":
      return NodeType.NODE_UNSPECIFIED;
    case 1:
    case "LINE_BREAK":
      return NodeType.LINE_BREAK;
    case 2:
    case "PARAGRAPH":
      return NodeType.PARAGRAPH;
    case 3:
    case "CODE_BLOCK":
      return NodeType.CODE_BLOCK;
    case 4:
    case "HEADING":
      return NodeType.HEADING;
    case 5:
    case "HORIZONTAL_RULE":
      return NodeType.HORIZONTAL_RULE;
    case 6:
    case "BLOCKQUOTE":
      return NodeType.BLOCKQUOTE;
    case 7:
    case "ORDERED_LIST":
      return NodeType.ORDERED_LIST;
    case 8:
    case "UNORDERED_LIST":
      return NodeType.UNORDERED_LIST;
    case 9:
    case "TASK_LIST":
      return NodeType.TASK_LIST;
    case 10:
    case "MATH_BLOCK":
      return NodeType.MATH_BLOCK;
    case 11:
    case "TABLE":
      return NodeType.TABLE;
    case 12:
    case "EMBEDDED_CONTENT":
      return NodeType.EMBEDDED_CONTENT;
    case 13:
    case "TEXT":
      return NodeType.TEXT;
    case 14:
    case "BOLD":
      return NodeType.BOLD;
    case 15:
    case "ITALIC":
      return NodeType.ITALIC;
    case 16:
    case "BOLD_ITALIC":
      return NodeType.BOLD_ITALIC;
    case 17:
    case "CODE":
      return NodeType.CODE;
    case 18:
    case "IMAGE":
      return NodeType.IMAGE;
    case 19:
    case "LINK":
      return NodeType.LINK;
    case 20:
    case "AUTO_LINK":
      return NodeType.AUTO_LINK;
    case 21:
    case "TAG":
      return NodeType.TAG;
    case 22:
    case "STRIKETHROUGH":
      return NodeType.STRIKETHROUGH;
    case 23:
    case "ESCAPING_CHARACTER":
      return NodeType.ESCAPING_CHARACTER;
    case 24:
    case "MATH":
      return NodeType.MATH;
    case 25:
    case "HIGHLIGHT":
      return NodeType.HIGHLIGHT;
    case 26:
    case "SUBSCRIPT":
      return NodeType.SUBSCRIPT;
    case 27:
    case "SUPERSCRIPT":
      return NodeType.SUPERSCRIPT;
    case 28:
    case "REFERENCED_CONTENT":
      return NodeType.REFERENCED_CONTENT;
    case -1:
    case "UNRECOGNIZED":
    default:
      return NodeType.UNRECOGNIZED;
  }
}

export function nodeTypeToNumber(object: NodeType): number {
  switch (object) {
    case NodeType.NODE_UNSPECIFIED:
      return 0;
    case NodeType.LINE_BREAK:
      return 1;
    case NodeType.PARAGRAPH:
      return 2;
    case NodeType.CODE_BLOCK:
      return 3;
    case NodeType.HEADING:
      return 4;
    case NodeType.HORIZONTAL_RULE:
      return 5;
    case NodeType.BLOCKQUOTE:
      return 6;
    case NodeType.ORDERED_LIST:
      return 7;
    case NodeType.UNORDERED_LIST:
      return 8;
    case NodeType.TASK_LIST:
      return 9;
    case NodeType.MATH_BLOCK:
      return 10;
    case NodeType.TABLE:
      return 11;
    case NodeType.EMBEDDED_CONTENT:
      return 12;
    case NodeType.TEXT:
      return 13;
    case NodeType.BOLD:
      return 14;
    case NodeType.ITALIC:
      return 15;
    case NodeType.BOLD_ITALIC:
      return 16;
    case NodeType.CODE:
      return 17;
    case NodeType.IMAGE:
      return 18;
    case NodeType.LINK:
      return 19;
    case NodeType.AUTO_LINK:
      return 20;
    case NodeType.TAG:
      return 21;
    case NodeType.STRIKETHROUGH:
      return 22;
    case NodeType.ESCAPING_CHARACTER:
      return 23;
    case NodeType.MATH:
      return 24;
    case NodeType.HIGHLIGHT:
      return 25;
    case NodeType.SUBSCRIPT:
      return 26;
    case NodeType.SUPERSCRIPT:
      return 27;
    case NodeType.REFERENCED_CONTENT:
      return 28;
    case NodeType.UNRECOGNIZED:
    default:
      return -1;
  }
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
}

export interface LineBreakNode {}

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

function createBaseNode(): Node {
  return {
    type: NodeType.NODE_UNSPECIFIED,
    lineBreakNode: undefined,
    paragraphNode: undefined,
    codeBlockNode: undefined,
    headingNode: undefined,
    horizontalRuleNode: undefined,
    blockquoteNode: undefined,
    orderedListNode: undefined,
    unorderedListNode: undefined,
    taskListNode: undefined,
    mathBlockNode: undefined,
    tableNode: undefined,
    embeddedContentNode: undefined,
    textNode: undefined,
    boldNode: undefined,
    italicNode: undefined,
    boldItalicNode: undefined,
    codeNode: undefined,
    imageNode: undefined,
    linkNode: undefined,
    autoLinkNode: undefined,
    tagNode: undefined,
    strikethroughNode: undefined,
    escapingCharacterNode: undefined,
    mathNode: undefined,
    highlightNode: undefined,
    subscriptNode: undefined,
    superscriptNode: undefined,
    referencedContentNode: undefined,
  };
}

export const Node = {
  encode(message: Node, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.type !== NodeType.NODE_UNSPECIFIED) {
      writer.uint32(8).int32(nodeTypeToNumber(message.type));
    }
    if (message.lineBreakNode !== undefined) {
      LineBreakNode.encode(message.lineBreakNode, writer.uint32(18).fork()).ldelim();
    }
    if (message.paragraphNode !== undefined) {
      ParagraphNode.encode(message.paragraphNode, writer.uint32(26).fork()).ldelim();
    }
    if (message.codeBlockNode !== undefined) {
      CodeBlockNode.encode(message.codeBlockNode, writer.uint32(34).fork()).ldelim();
    }
    if (message.headingNode !== undefined) {
      HeadingNode.encode(message.headingNode, writer.uint32(42).fork()).ldelim();
    }
    if (message.horizontalRuleNode !== undefined) {
      HorizontalRuleNode.encode(message.horizontalRuleNode, writer.uint32(50).fork()).ldelim();
    }
    if (message.blockquoteNode !== undefined) {
      BlockquoteNode.encode(message.blockquoteNode, writer.uint32(58).fork()).ldelim();
    }
    if (message.orderedListNode !== undefined) {
      OrderedListNode.encode(message.orderedListNode, writer.uint32(66).fork()).ldelim();
    }
    if (message.unorderedListNode !== undefined) {
      UnorderedListNode.encode(message.unorderedListNode, writer.uint32(74).fork()).ldelim();
    }
    if (message.taskListNode !== undefined) {
      TaskListNode.encode(message.taskListNode, writer.uint32(82).fork()).ldelim();
    }
    if (message.mathBlockNode !== undefined) {
      MathBlockNode.encode(message.mathBlockNode, writer.uint32(90).fork()).ldelim();
    }
    if (message.tableNode !== undefined) {
      TableNode.encode(message.tableNode, writer.uint32(98).fork()).ldelim();
    }
    if (message.embeddedContentNode !== undefined) {
      EmbeddedContentNode.encode(message.embeddedContentNode, writer.uint32(106).fork()).ldelim();
    }
    if (message.textNode !== undefined) {
      TextNode.encode(message.textNode, writer.uint32(114).fork()).ldelim();
    }
    if (message.boldNode !== undefined) {
      BoldNode.encode(message.boldNode, writer.uint32(122).fork()).ldelim();
    }
    if (message.italicNode !== undefined) {
      ItalicNode.encode(message.italicNode, writer.uint32(130).fork()).ldelim();
    }
    if (message.boldItalicNode !== undefined) {
      BoldItalicNode.encode(message.boldItalicNode, writer.uint32(138).fork()).ldelim();
    }
    if (message.codeNode !== undefined) {
      CodeNode.encode(message.codeNode, writer.uint32(146).fork()).ldelim();
    }
    if (message.imageNode !== undefined) {
      ImageNode.encode(message.imageNode, writer.uint32(154).fork()).ldelim();
    }
    if (message.linkNode !== undefined) {
      LinkNode.encode(message.linkNode, writer.uint32(162).fork()).ldelim();
    }
    if (message.autoLinkNode !== undefined) {
      AutoLinkNode.encode(message.autoLinkNode, writer.uint32(170).fork()).ldelim();
    }
    if (message.tagNode !== undefined) {
      TagNode.encode(message.tagNode, writer.uint32(178).fork()).ldelim();
    }
    if (message.strikethroughNode !== undefined) {
      StrikethroughNode.encode(message.strikethroughNode, writer.uint32(186).fork()).ldelim();
    }
    if (message.escapingCharacterNode !== undefined) {
      EscapingCharacterNode.encode(message.escapingCharacterNode, writer.uint32(194).fork()).ldelim();
    }
    if (message.mathNode !== undefined) {
      MathNode.encode(message.mathNode, writer.uint32(202).fork()).ldelim();
    }
    if (message.highlightNode !== undefined) {
      HighlightNode.encode(message.highlightNode, writer.uint32(210).fork()).ldelim();
    }
    if (message.subscriptNode !== undefined) {
      SubscriptNode.encode(message.subscriptNode, writer.uint32(218).fork()).ldelim();
    }
    if (message.superscriptNode !== undefined) {
      SuperscriptNode.encode(message.superscriptNode, writer.uint32(226).fork()).ldelim();
    }
    if (message.referencedContentNode !== undefined) {
      ReferencedContentNode.encode(message.referencedContentNode, writer.uint32(234).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Node {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.type = nodeTypeFromJSON(reader.int32());
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.lineBreakNode = LineBreakNode.decode(reader, reader.uint32());
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.paragraphNode = ParagraphNode.decode(reader, reader.uint32());
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.codeBlockNode = CodeBlockNode.decode(reader, reader.uint32());
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.headingNode = HeadingNode.decode(reader, reader.uint32());
          continue;
        case 6:
          if (tag !== 50) {
            break;
          }

          message.horizontalRuleNode = HorizontalRuleNode.decode(reader, reader.uint32());
          continue;
        case 7:
          if (tag !== 58) {
            break;
          }

          message.blockquoteNode = BlockquoteNode.decode(reader, reader.uint32());
          continue;
        case 8:
          if (tag !== 66) {
            break;
          }

          message.orderedListNode = OrderedListNode.decode(reader, reader.uint32());
          continue;
        case 9:
          if (tag !== 74) {
            break;
          }

          message.unorderedListNode = UnorderedListNode.decode(reader, reader.uint32());
          continue;
        case 10:
          if (tag !== 82) {
            break;
          }

          message.taskListNode = TaskListNode.decode(reader, reader.uint32());
          continue;
        case 11:
          if (tag !== 90) {
            break;
          }

          message.mathBlockNode = MathBlockNode.decode(reader, reader.uint32());
          continue;
        case 12:
          if (tag !== 98) {
            break;
          }

          message.tableNode = TableNode.decode(reader, reader.uint32());
          continue;
        case 13:
          if (tag !== 106) {
            break;
          }

          message.embeddedContentNode = EmbeddedContentNode.decode(reader, reader.uint32());
          continue;
        case 14:
          if (tag !== 114) {
            break;
          }

          message.textNode = TextNode.decode(reader, reader.uint32());
          continue;
        case 15:
          if (tag !== 122) {
            break;
          }

          message.boldNode = BoldNode.decode(reader, reader.uint32());
          continue;
        case 16:
          if (tag !== 130) {
            break;
          }

          message.italicNode = ItalicNode.decode(reader, reader.uint32());
          continue;
        case 17:
          if (tag !== 138) {
            break;
          }

          message.boldItalicNode = BoldItalicNode.decode(reader, reader.uint32());
          continue;
        case 18:
          if (tag !== 146) {
            break;
          }

          message.codeNode = CodeNode.decode(reader, reader.uint32());
          continue;
        case 19:
          if (tag !== 154) {
            break;
          }

          message.imageNode = ImageNode.decode(reader, reader.uint32());
          continue;
        case 20:
          if (tag !== 162) {
            break;
          }

          message.linkNode = LinkNode.decode(reader, reader.uint32());
          continue;
        case 21:
          if (tag !== 170) {
            break;
          }

          message.autoLinkNode = AutoLinkNode.decode(reader, reader.uint32());
          continue;
        case 22:
          if (tag !== 178) {
            break;
          }

          message.tagNode = TagNode.decode(reader, reader.uint32());
          continue;
        case 23:
          if (tag !== 186) {
            break;
          }

          message.strikethroughNode = StrikethroughNode.decode(reader, reader.uint32());
          continue;
        case 24:
          if (tag !== 194) {
            break;
          }

          message.escapingCharacterNode = EscapingCharacterNode.decode(reader, reader.uint32());
          continue;
        case 25:
          if (tag !== 202) {
            break;
          }

          message.mathNode = MathNode.decode(reader, reader.uint32());
          continue;
        case 26:
          if (tag !== 210) {
            break;
          }

          message.highlightNode = HighlightNode.decode(reader, reader.uint32());
          continue;
        case 27:
          if (tag !== 218) {
            break;
          }

          message.subscriptNode = SubscriptNode.decode(reader, reader.uint32());
          continue;
        case 28:
          if (tag !== 226) {
            break;
          }

          message.superscriptNode = SuperscriptNode.decode(reader, reader.uint32());
          continue;
        case 29:
          if (tag !== 234) {
            break;
          }

          message.referencedContentNode = ReferencedContentNode.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<Node>): Node {
    return Node.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<Node>): Node {
    const message = createBaseNode();
    message.type = object.type ?? NodeType.NODE_UNSPECIFIED;
    message.lineBreakNode =
      object.lineBreakNode !== undefined && object.lineBreakNode !== null ? LineBreakNode.fromPartial(object.lineBreakNode) : undefined;
    message.paragraphNode =
      object.paragraphNode !== undefined && object.paragraphNode !== null ? ParagraphNode.fromPartial(object.paragraphNode) : undefined;
    message.codeBlockNode =
      object.codeBlockNode !== undefined && object.codeBlockNode !== null ? CodeBlockNode.fromPartial(object.codeBlockNode) : undefined;
    message.headingNode =
      object.headingNode !== undefined && object.headingNode !== null ? HeadingNode.fromPartial(object.headingNode) : undefined;
    message.horizontalRuleNode =
      object.horizontalRuleNode !== undefined && object.horizontalRuleNode !== null
        ? HorizontalRuleNode.fromPartial(object.horizontalRuleNode)
        : undefined;
    message.blockquoteNode =
      object.blockquoteNode !== undefined && object.blockquoteNode !== null ? BlockquoteNode.fromPartial(object.blockquoteNode) : undefined;
    message.orderedListNode =
      object.orderedListNode !== undefined && object.orderedListNode !== null
        ? OrderedListNode.fromPartial(object.orderedListNode)
        : undefined;
    message.unorderedListNode =
      object.unorderedListNode !== undefined && object.unorderedListNode !== null
        ? UnorderedListNode.fromPartial(object.unorderedListNode)
        : undefined;
    message.taskListNode =
      object.taskListNode !== undefined && object.taskListNode !== null ? TaskListNode.fromPartial(object.taskListNode) : undefined;
    message.mathBlockNode =
      object.mathBlockNode !== undefined && object.mathBlockNode !== null ? MathBlockNode.fromPartial(object.mathBlockNode) : undefined;
    message.tableNode = object.tableNode !== undefined && object.tableNode !== null ? TableNode.fromPartial(object.tableNode) : undefined;
    message.embeddedContentNode =
      object.embeddedContentNode !== undefined && object.embeddedContentNode !== null
        ? EmbeddedContentNode.fromPartial(object.embeddedContentNode)
        : undefined;
    message.textNode = object.textNode !== undefined && object.textNode !== null ? TextNode.fromPartial(object.textNode) : undefined;
    message.boldNode = object.boldNode !== undefined && object.boldNode !== null ? BoldNode.fromPartial(object.boldNode) : undefined;
    message.italicNode =
      object.italicNode !== undefined && object.italicNode !== null ? ItalicNode.fromPartial(object.italicNode) : undefined;
    message.boldItalicNode =
      object.boldItalicNode !== undefined && object.boldItalicNode !== null ? BoldItalicNode.fromPartial(object.boldItalicNode) : undefined;
    message.codeNode = object.codeNode !== undefined && object.codeNode !== null ? CodeNode.fromPartial(object.codeNode) : undefined;
    message.imageNode = object.imageNode !== undefined && object.imageNode !== null ? ImageNode.fromPartial(object.imageNode) : undefined;
    message.linkNode = object.linkNode !== undefined && object.linkNode !== null ? LinkNode.fromPartial(object.linkNode) : undefined;
    message.autoLinkNode =
      object.autoLinkNode !== undefined && object.autoLinkNode !== null ? AutoLinkNode.fromPartial(object.autoLinkNode) : undefined;
    message.tagNode = object.tagNode !== undefined && object.tagNode !== null ? TagNode.fromPartial(object.tagNode) : undefined;
    message.strikethroughNode =
      object.strikethroughNode !== undefined && object.strikethroughNode !== null
        ? StrikethroughNode.fromPartial(object.strikethroughNode)
        : undefined;
    message.escapingCharacterNode =
      object.escapingCharacterNode !== undefined && object.escapingCharacterNode !== null
        ? EscapingCharacterNode.fromPartial(object.escapingCharacterNode)
        : undefined;
    message.mathNode = object.mathNode !== undefined && object.mathNode !== null ? MathNode.fromPartial(object.mathNode) : undefined;
    message.highlightNode =
      object.highlightNode !== undefined && object.highlightNode !== null ? HighlightNode.fromPartial(object.highlightNode) : undefined;
    message.subscriptNode =
      object.subscriptNode !== undefined && object.subscriptNode !== null ? SubscriptNode.fromPartial(object.subscriptNode) : undefined;
    message.superscriptNode =
      object.superscriptNode !== undefined && object.superscriptNode !== null
        ? SuperscriptNode.fromPartial(object.superscriptNode)
        : undefined;
    message.referencedContentNode =
      object.referencedContentNode !== undefined && object.referencedContentNode !== null
        ? ReferencedContentNode.fromPartial(object.referencedContentNode)
        : undefined;
    return message;
  },
};

function createBaseLineBreakNode(): LineBreakNode {
  return {};
}

export const LineBreakNode = {
  encode(_: LineBreakNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): LineBreakNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseLineBreakNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<LineBreakNode>): LineBreakNode {
    return LineBreakNode.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<LineBreakNode>): LineBreakNode {
    const message = createBaseLineBreakNode();
    return message;
  },
};

function createBaseParagraphNode(): ParagraphNode {
  return { children: [] };
}

export const ParagraphNode = {
  encode(message: ParagraphNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.children) {
      Node.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ParagraphNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseParagraphNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.children.push(Node.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ParagraphNode>): ParagraphNode {
    return ParagraphNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ParagraphNode>): ParagraphNode {
    const message = createBaseParagraphNode();
    message.children = object.children?.map((e) => Node.fromPartial(e)) || [];
    return message;
  },
};

function createBaseCodeBlockNode(): CodeBlockNode {
  return { language: "", content: "" };
}

export const CodeBlockNode = {
  encode(message: CodeBlockNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.language !== "") {
      writer.uint32(10).string(message.language);
    }
    if (message.content !== "") {
      writer.uint32(18).string(message.content);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CodeBlockNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCodeBlockNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.language = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.content = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<CodeBlockNode>): CodeBlockNode {
    return CodeBlockNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CodeBlockNode>): CodeBlockNode {
    const message = createBaseCodeBlockNode();
    message.language = object.language ?? "";
    message.content = object.content ?? "";
    return message;
  },
};

function createBaseHeadingNode(): HeadingNode {
  return { level: 0, children: [] };
}

export const HeadingNode = {
  encode(message: HeadingNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.level !== 0) {
      writer.uint32(8).int32(message.level);
    }
    for (const v of message.children) {
      Node.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): HeadingNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseHeadingNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.level = reader.int32();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.children.push(Node.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<HeadingNode>): HeadingNode {
    return HeadingNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<HeadingNode>): HeadingNode {
    const message = createBaseHeadingNode();
    message.level = object.level ?? 0;
    message.children = object.children?.map((e) => Node.fromPartial(e)) || [];
    return message;
  },
};

function createBaseHorizontalRuleNode(): HorizontalRuleNode {
  return { symbol: "" };
}

export const HorizontalRuleNode = {
  encode(message: HorizontalRuleNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.symbol !== "") {
      writer.uint32(10).string(message.symbol);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): HorizontalRuleNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseHorizontalRuleNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.symbol = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<HorizontalRuleNode>): HorizontalRuleNode {
    return HorizontalRuleNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<HorizontalRuleNode>): HorizontalRuleNode {
    const message = createBaseHorizontalRuleNode();
    message.symbol = object.symbol ?? "";
    return message;
  },
};

function createBaseBlockquoteNode(): BlockquoteNode {
  return { children: [] };
}

export const BlockquoteNode = {
  encode(message: BlockquoteNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.children) {
      Node.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BlockquoteNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBlockquoteNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.children.push(Node.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<BlockquoteNode>): BlockquoteNode {
    return BlockquoteNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<BlockquoteNode>): BlockquoteNode {
    const message = createBaseBlockquoteNode();
    message.children = object.children?.map((e) => Node.fromPartial(e)) || [];
    return message;
  },
};

function createBaseOrderedListNode(): OrderedListNode {
  return { number: "", indent: 0, children: [] };
}

export const OrderedListNode = {
  encode(message: OrderedListNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.number !== "") {
      writer.uint32(10).string(message.number);
    }
    if (message.indent !== 0) {
      writer.uint32(16).int32(message.indent);
    }
    for (const v of message.children) {
      Node.encode(v!, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OrderedListNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOrderedListNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.number = reader.string();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.indent = reader.int32();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.children.push(Node.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<OrderedListNode>): OrderedListNode {
    return OrderedListNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<OrderedListNode>): OrderedListNode {
    const message = createBaseOrderedListNode();
    message.number = object.number ?? "";
    message.indent = object.indent ?? 0;
    message.children = object.children?.map((e) => Node.fromPartial(e)) || [];
    return message;
  },
};

function createBaseUnorderedListNode(): UnorderedListNode {
  return { symbol: "", indent: 0, children: [] };
}

export const UnorderedListNode = {
  encode(message: UnorderedListNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.symbol !== "") {
      writer.uint32(10).string(message.symbol);
    }
    if (message.indent !== 0) {
      writer.uint32(16).int32(message.indent);
    }
    for (const v of message.children) {
      Node.encode(v!, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UnorderedListNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUnorderedListNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.symbol = reader.string();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.indent = reader.int32();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.children.push(Node.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<UnorderedListNode>): UnorderedListNode {
    return UnorderedListNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<UnorderedListNode>): UnorderedListNode {
    const message = createBaseUnorderedListNode();
    message.symbol = object.symbol ?? "";
    message.indent = object.indent ?? 0;
    message.children = object.children?.map((e) => Node.fromPartial(e)) || [];
    return message;
  },
};

function createBaseTaskListNode(): TaskListNode {
  return { symbol: "", indent: 0, complete: false, children: [] };
}

export const TaskListNode = {
  encode(message: TaskListNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.symbol !== "") {
      writer.uint32(10).string(message.symbol);
    }
    if (message.indent !== 0) {
      writer.uint32(16).int32(message.indent);
    }
    if (message.complete === true) {
      writer.uint32(24).bool(message.complete);
    }
    for (const v of message.children) {
      Node.encode(v!, writer.uint32(34).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TaskListNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTaskListNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.symbol = reader.string();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.indent = reader.int32();
          continue;
        case 3:
          if (tag !== 24) {
            break;
          }

          message.complete = reader.bool();
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.children.push(Node.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<TaskListNode>): TaskListNode {
    return TaskListNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<TaskListNode>): TaskListNode {
    const message = createBaseTaskListNode();
    message.symbol = object.symbol ?? "";
    message.indent = object.indent ?? 0;
    message.complete = object.complete ?? false;
    message.children = object.children?.map((e) => Node.fromPartial(e)) || [];
    return message;
  },
};

function createBaseMathBlockNode(): MathBlockNode {
  return { content: "" };
}

export const MathBlockNode = {
  encode(message: MathBlockNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.content !== "") {
      writer.uint32(10).string(message.content);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): MathBlockNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMathBlockNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.content = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<MathBlockNode>): MathBlockNode {
    return MathBlockNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<MathBlockNode>): MathBlockNode {
    const message = createBaseMathBlockNode();
    message.content = object.content ?? "";
    return message;
  },
};

function createBaseTableNode(): TableNode {
  return { header: [], delimiter: [], rows: [] };
}

export const TableNode = {
  encode(message: TableNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.header) {
      writer.uint32(10).string(v!);
    }
    for (const v of message.delimiter) {
      writer.uint32(18).string(v!);
    }
    for (const v of message.rows) {
      TableNode_Row.encode(v!, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TableNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTableNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.header.push(reader.string());
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.delimiter.push(reader.string());
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.rows.push(TableNode_Row.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<TableNode>): TableNode {
    return TableNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<TableNode>): TableNode {
    const message = createBaseTableNode();
    message.header = object.header?.map((e) => e) || [];
    message.delimiter = object.delimiter?.map((e) => e) || [];
    message.rows = object.rows?.map((e) => TableNode_Row.fromPartial(e)) || [];
    return message;
  },
};

function createBaseTableNode_Row(): TableNode_Row {
  return { cells: [] };
}

export const TableNode_Row = {
  encode(message: TableNode_Row, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.cells) {
      writer.uint32(10).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TableNode_Row {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTableNode_Row();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.cells.push(reader.string());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<TableNode_Row>): TableNode_Row {
    return TableNode_Row.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<TableNode_Row>): TableNode_Row {
    const message = createBaseTableNode_Row();
    message.cells = object.cells?.map((e) => e) || [];
    return message;
  },
};

function createBaseEmbeddedContentNode(): EmbeddedContentNode {
  return { resourceName: "", params: "" };
}

export const EmbeddedContentNode = {
  encode(message: EmbeddedContentNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.resourceName !== "") {
      writer.uint32(10).string(message.resourceName);
    }
    if (message.params !== "") {
      writer.uint32(18).string(message.params);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): EmbeddedContentNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseEmbeddedContentNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.resourceName = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.params = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<EmbeddedContentNode>): EmbeddedContentNode {
    return EmbeddedContentNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<EmbeddedContentNode>): EmbeddedContentNode {
    const message = createBaseEmbeddedContentNode();
    message.resourceName = object.resourceName ?? "";
    message.params = object.params ?? "";
    return message;
  },
};

function createBaseTextNode(): TextNode {
  return { content: "" };
}

export const TextNode = {
  encode(message: TextNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.content !== "") {
      writer.uint32(10).string(message.content);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TextNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTextNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.content = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<TextNode>): TextNode {
    return TextNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<TextNode>): TextNode {
    const message = createBaseTextNode();
    message.content = object.content ?? "";
    return message;
  },
};

function createBaseBoldNode(): BoldNode {
  return { symbol: "", children: [] };
}

export const BoldNode = {
  encode(message: BoldNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.symbol !== "") {
      writer.uint32(10).string(message.symbol);
    }
    for (const v of message.children) {
      Node.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BoldNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBoldNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.symbol = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.children.push(Node.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<BoldNode>): BoldNode {
    return BoldNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<BoldNode>): BoldNode {
    const message = createBaseBoldNode();
    message.symbol = object.symbol ?? "";
    message.children = object.children?.map((e) => Node.fromPartial(e)) || [];
    return message;
  },
};

function createBaseItalicNode(): ItalicNode {
  return { symbol: "", content: "" };
}

export const ItalicNode = {
  encode(message: ItalicNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.symbol !== "") {
      writer.uint32(10).string(message.symbol);
    }
    if (message.content !== "") {
      writer.uint32(18).string(message.content);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ItalicNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseItalicNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.symbol = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.content = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ItalicNode>): ItalicNode {
    return ItalicNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ItalicNode>): ItalicNode {
    const message = createBaseItalicNode();
    message.symbol = object.symbol ?? "";
    message.content = object.content ?? "";
    return message;
  },
};

function createBaseBoldItalicNode(): BoldItalicNode {
  return { symbol: "", content: "" };
}

export const BoldItalicNode = {
  encode(message: BoldItalicNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.symbol !== "") {
      writer.uint32(10).string(message.symbol);
    }
    if (message.content !== "") {
      writer.uint32(18).string(message.content);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BoldItalicNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBoldItalicNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.symbol = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.content = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<BoldItalicNode>): BoldItalicNode {
    return BoldItalicNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<BoldItalicNode>): BoldItalicNode {
    const message = createBaseBoldItalicNode();
    message.symbol = object.symbol ?? "";
    message.content = object.content ?? "";
    return message;
  },
};

function createBaseCodeNode(): CodeNode {
  return { content: "" };
}

export const CodeNode = {
  encode(message: CodeNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.content !== "") {
      writer.uint32(10).string(message.content);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CodeNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCodeNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.content = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<CodeNode>): CodeNode {
    return CodeNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CodeNode>): CodeNode {
    const message = createBaseCodeNode();
    message.content = object.content ?? "";
    return message;
  },
};

function createBaseImageNode(): ImageNode {
  return { altText: "", url: "" };
}

export const ImageNode = {
  encode(message: ImageNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.altText !== "") {
      writer.uint32(10).string(message.altText);
    }
    if (message.url !== "") {
      writer.uint32(18).string(message.url);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ImageNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseImageNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.altText = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.url = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ImageNode>): ImageNode {
    return ImageNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ImageNode>): ImageNode {
    const message = createBaseImageNode();
    message.altText = object.altText ?? "";
    message.url = object.url ?? "";
    return message;
  },
};

function createBaseLinkNode(): LinkNode {
  return { text: "", url: "" };
}

export const LinkNode = {
  encode(message: LinkNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.text !== "") {
      writer.uint32(10).string(message.text);
    }
    if (message.url !== "") {
      writer.uint32(18).string(message.url);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): LinkNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseLinkNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.text = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.url = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<LinkNode>): LinkNode {
    return LinkNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<LinkNode>): LinkNode {
    const message = createBaseLinkNode();
    message.text = object.text ?? "";
    message.url = object.url ?? "";
    return message;
  },
};

function createBaseAutoLinkNode(): AutoLinkNode {
  return { url: "", isRawText: false };
}

export const AutoLinkNode = {
  encode(message: AutoLinkNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.url !== "") {
      writer.uint32(10).string(message.url);
    }
    if (message.isRawText === true) {
      writer.uint32(16).bool(message.isRawText);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AutoLinkNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAutoLinkNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.url = reader.string();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.isRawText = reader.bool();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<AutoLinkNode>): AutoLinkNode {
    return AutoLinkNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<AutoLinkNode>): AutoLinkNode {
    const message = createBaseAutoLinkNode();
    message.url = object.url ?? "";
    message.isRawText = object.isRawText ?? false;
    return message;
  },
};

function createBaseTagNode(): TagNode {
  return { content: "" };
}

export const TagNode = {
  encode(message: TagNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.content !== "") {
      writer.uint32(10).string(message.content);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TagNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTagNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.content = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<TagNode>): TagNode {
    return TagNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<TagNode>): TagNode {
    const message = createBaseTagNode();
    message.content = object.content ?? "";
    return message;
  },
};

function createBaseStrikethroughNode(): StrikethroughNode {
  return { content: "" };
}

export const StrikethroughNode = {
  encode(message: StrikethroughNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.content !== "") {
      writer.uint32(10).string(message.content);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): StrikethroughNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseStrikethroughNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.content = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<StrikethroughNode>): StrikethroughNode {
    return StrikethroughNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<StrikethroughNode>): StrikethroughNode {
    const message = createBaseStrikethroughNode();
    message.content = object.content ?? "";
    return message;
  },
};

function createBaseEscapingCharacterNode(): EscapingCharacterNode {
  return { symbol: "" };
}

export const EscapingCharacterNode = {
  encode(message: EscapingCharacterNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.symbol !== "") {
      writer.uint32(10).string(message.symbol);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): EscapingCharacterNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseEscapingCharacterNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.symbol = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<EscapingCharacterNode>): EscapingCharacterNode {
    return EscapingCharacterNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<EscapingCharacterNode>): EscapingCharacterNode {
    const message = createBaseEscapingCharacterNode();
    message.symbol = object.symbol ?? "";
    return message;
  },
};

function createBaseMathNode(): MathNode {
  return { content: "" };
}

export const MathNode = {
  encode(message: MathNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.content !== "") {
      writer.uint32(10).string(message.content);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): MathNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMathNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.content = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<MathNode>): MathNode {
    return MathNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<MathNode>): MathNode {
    const message = createBaseMathNode();
    message.content = object.content ?? "";
    return message;
  },
};

function createBaseHighlightNode(): HighlightNode {
  return { content: "" };
}

export const HighlightNode = {
  encode(message: HighlightNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.content !== "") {
      writer.uint32(10).string(message.content);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): HighlightNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseHighlightNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.content = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<HighlightNode>): HighlightNode {
    return HighlightNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<HighlightNode>): HighlightNode {
    const message = createBaseHighlightNode();
    message.content = object.content ?? "";
    return message;
  },
};

function createBaseSubscriptNode(): SubscriptNode {
  return { content: "" };
}

export const SubscriptNode = {
  encode(message: SubscriptNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.content !== "") {
      writer.uint32(10).string(message.content);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SubscriptNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSubscriptNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.content = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<SubscriptNode>): SubscriptNode {
    return SubscriptNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<SubscriptNode>): SubscriptNode {
    const message = createBaseSubscriptNode();
    message.content = object.content ?? "";
    return message;
  },
};

function createBaseSuperscriptNode(): SuperscriptNode {
  return { content: "" };
}

export const SuperscriptNode = {
  encode(message: SuperscriptNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.content !== "") {
      writer.uint32(10).string(message.content);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SuperscriptNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSuperscriptNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.content = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<SuperscriptNode>): SuperscriptNode {
    return SuperscriptNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<SuperscriptNode>): SuperscriptNode {
    const message = createBaseSuperscriptNode();
    message.content = object.content ?? "";
    return message;
  },
};

function createBaseReferencedContentNode(): ReferencedContentNode {
  return { resourceName: "", params: "" };
}

export const ReferencedContentNode = {
  encode(message: ReferencedContentNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.resourceName !== "") {
      writer.uint32(10).string(message.resourceName);
    }
    if (message.params !== "") {
      writer.uint32(18).string(message.params);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ReferencedContentNode {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseReferencedContentNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.resourceName = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.params = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ReferencedContentNode>): ReferencedContentNode {
    return ReferencedContentNode.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ReferencedContentNode>): ReferencedContentNode {
    const message = createBaseReferencedContentNode();
    message.resourceName = object.resourceName ?? "";
    message.params = object.params ?? "";
    return message;
  },
};

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin
  ? T
  : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends ReadonlyArray<infer U>
      ? ReadonlyArray<DeepPartial<U>>
      : T extends {}
        ? { [K in keyof T]?: DeepPartial<T[K]> }
        : Partial<T>;
