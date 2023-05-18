package ast

type Node struct {
	Type     string
	Text     string
	Children []*Node
}

type Document struct {
	Nodes []*Node
}

func NewDocument() *Document {
	return &Document{}
}

func (d *Document) AddNode(node *Node) {
	d.Nodes = append(d.Nodes, node)
}
