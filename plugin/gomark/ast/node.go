package ast

type Node interface {
	// Type returns a node type.
	Type() NodeType

	// String returns a string representation of this node.
	// This method is used for debugging.
	String() string

	// GetPrevSibling returns a previous sibling node of this node.
	GetPrevSibling() Node

	// GetNextSibling returns a next sibling node of this node.
	GetNextSibling() Node

	// SetPrevSibling sets a previous sibling node to this node.
	SetPrevSibling(Node)

	// SetNextSibling sets a next sibling node to this node.
	SetNextSibling(Node)
}

type NodeType int

func (t NodeType) String() string {
	return nodeTypeNames[t]
}

var nodeTypeIndex NodeType
var nodeTypeNames = []string{""}

func NewNodeType(name string) NodeType {
	nodeTypeNames = append(nodeTypeNames, name)
	nodeTypeIndex++
	return nodeTypeIndex
}

type BaseNode struct {
	prevSibling Node

	nextSibling Node
}

func (n *BaseNode) GetPrevSibling() Node {
	return n.prevSibling
}

func (n *BaseNode) GetNextSibling() Node {
	return n.nextSibling
}

func (n *BaseNode) SetPrevSibling(node Node) {
	n.prevSibling = node
}

func (n *BaseNode) SetNextSibling(node Node) {
	n.nextSibling = node
}
