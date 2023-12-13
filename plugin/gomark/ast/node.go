package ast

type Node interface {
	// Type returns a node type.
	Type() NodeType

	// String returns a string representation of this node.
	// This method is used for debugging.
	String() string

	// GetParent returns a parent node of this node.
	GetParent() Node

	// GetPrevSibling returns a previous sibling node of this node.
	GetPrevSibling() Node

	// GetNextSibling returns a next sibling node of this node.
	GetNextSibling() Node

	// GetChildren returns children nodes of this node.
	GetChildren() []Node

	// SetParent sets a parent node to this node.
	SetParent(Node)

	// SetPrevSibling sets a previous sibling node to this node.
	SetPrevSibling(Node)

	// SetNextSibling sets a next sibling node to this node.
	SetNextSibling(Node)

	// SetChildren sets children nodes to this node.
	SetChildren([]Node)
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
	parent Node

	prevSibling Node

	nextSibling Node

	children []Node
}

func (n *BaseNode) GetParent() Node {
	return n.parent
}

func (n *BaseNode) GetPrevSibling() Node {
	return n.prevSibling
}

func (n *BaseNode) GetNextSibling() Node {
	return n.nextSibling
}

func (n *BaseNode) GetChildren() []Node {
	return n.children
}

func (n *BaseNode) SetParent(node Node) {
	n.parent = node
}

func (n *BaseNode) SetPrevSibling(node Node) {
	n.prevSibling = node
}

func (n *BaseNode) SetNextSibling(node Node) {
	n.nextSibling = node
}

func (n *BaseNode) SetChildren(nodes []Node) {
	n.children = nodes
}
