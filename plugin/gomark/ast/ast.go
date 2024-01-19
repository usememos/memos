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
	MathBlockNode
	TableNode
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
	MathNode
	HighlightNode
	SubscriptNode
	SuperscriptNode
)

type Node interface {
	// Type returns a node type.
	Type() NodeType

	// Restore returns a string representation of this node.
	Restore() string

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

func IsBlockNode(node Node) bool {
	switch node.Type() {
	case ParagraphNode, CodeBlockNode, HeadingNode, HorizontalRuleNode, BlockquoteNode, OrderedListNode, UnorderedListNode, TaskListNode, MathBlockNode:
		return true
	default:
		return false
	}
}
