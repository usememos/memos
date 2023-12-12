package ast

type Node interface {
	Type() NodeType
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
