package ast

type NodeType uint32

const (
	UnknownNode NodeType = iota
	// Block nodes.
	LineBreakNode
	ParagraphNode
	CodeBlockNode
	HeadingNode
	HorizontalRuleNode
	BlockquoteNode
	OrderedListNode
	UnorderedListNode
	TaskListNode
	// Inline nodes.
	TextNode
	BoldNode
	ItalicNode
	BoldItalicNode
	CodeNode
	ImageNode
	LinkNode
	AutoLinkNode
	TagNode
	StrikethroughNode
	EscapingCharacterNode
)

func (t NodeType) String() string {
	switch t {
	case LineBreakNode:
		return "LineBreakNode"
	case ParagraphNode:
		return "ParagraphNode"
	case CodeBlockNode:
		return "CodeBlockNode"
	case HeadingNode:
		return "HeadingNode"
	case HorizontalRuleNode:
		return "HorizontalRuleNode"
	case BlockquoteNode:
		return "BlockquoteNode"
	case OrderedListNode:
		return "OrderedListNode"
	case UnorderedListNode:
		return "UnorderedListNode"
	case TaskListNode:
		return "TaskListNode"
	case TextNode:
		return "TextNode"
	case BoldNode:
		return "BoldNode"
	case ItalicNode:
		return "ItalicNode"
	case BoldItalicNode:
		return "BoldItalicNode"
	case CodeNode:
		return "CodeNode"
	case ImageNode:
		return "ImageNode"
	case LinkNode:
		return "LinkNode"
	case AutoLinkNode:
		return "AutoLinkNode"
	case TagNode:
		return "TagNode"
	case StrikethroughNode:
		return "StrikethroughNode"
	case EscapingCharacterNode:
		return "EscapingCharacterNode"
	default:
		return "UnknownNode"
	}
}

type Node interface {
	// Type returns a node type.
	Type() NodeType

	// PrevSibling returns a previous sibling node of this node.
	PrevSibling() Node

	// NextSibling returns a next sibling node of this node.
	NextSibling() Node

	// SetPrevSibling sets a previous sibling node to this node.
	SetPrevSibling(Node)

	// SetNextSibling sets a next sibling node to this node.
	SetNextSibling(Node)
}

type BaseNode struct {
	prevSibling Node

	nextSibling Node
}

func (n *BaseNode) PrevSibling() Node {
	return n.prevSibling
}

func (n *BaseNode) NextSibling() Node {
	return n.nextSibling
}

func (n *BaseNode) SetPrevSibling(node Node) {
	n.prevSibling = node
}

func (n *BaseNode) SetNextSibling(node Node) {
	n.nextSibling = node
}
