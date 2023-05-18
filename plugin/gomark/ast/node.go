package ast

func NewNode(tp, text string) *Node {
	return &Node{
		Type: tp,
		Text: text,
	}
}

func (n *Node) AddChild(child *Node) {
	n.Children = append(n.Children, child)
}
