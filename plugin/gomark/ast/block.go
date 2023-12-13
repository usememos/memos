package ast

import "fmt"

type BaseBlock struct {
	BaseNode
}

type LineBreak struct {
	BaseBlock
}

var NodeTypeLineBreak = NewNodeType("LineBreak")

func (*LineBreak) Type() NodeType {
	return NodeTypeLineBreak
}

func (n *LineBreak) String() string {
	return n.Type().String()
}

type Paragraph struct {
	BaseBlock

	Children []Node
}

var NodeTypeParagraph = NewNodeType("Paragraph")

func (*Paragraph) Type() NodeType {
	return NodeTypeParagraph
}

func (n *Paragraph) String() string {
	str := n.Type().String()
	for _, child := range n.Children {
		str += " " + child.String()
	}
	return str
}

type CodeBlock struct {
	BaseBlock

	Language string
	Content  string
}

var NodeTypeCodeBlock = NewNodeType("CodeBlock")

func (*CodeBlock) Type() NodeType {
	return NodeTypeCodeBlock
}

func (n *CodeBlock) String() string {
	return n.Type().String() + " " + n.Language + " " + n.Content
}

type Heading struct {
	BaseBlock

	Level    int
	Children []Node
}

var NodeTypeHeading = NewNodeType("Heading")

func (*Heading) Type() NodeType {
	return NodeTypeHeading
}

func (n *Heading) String() string {
	str := n.Type().String() + " " + fmt.Sprintf("%d", n.Level)
	for _, child := range n.Children {
		str += " " + child.String()
	}
	return str
}

type HorizontalRule struct {
	BaseBlock

	// Symbol is "*" or "-" or "_".
	Symbol string
}

var NodeTypeHorizontalRule = NewNodeType("HorizontalRule")

func (*HorizontalRule) Type() NodeType {
	return NodeTypeHorizontalRule
}

func (n *HorizontalRule) String() string {
	return n.Type().String()
}

type Blockquote struct {
	BaseBlock

	Children []Node
}

var NodeTypeBlockquote = NewNodeType("Blockquote")

func (*Blockquote) Type() NodeType {
	return NodeTypeBlockquote
}

func (n *Blockquote) String() string {
	str := n.Type().String()
	for _, child := range n.Children {
		str += " " + child.String()
	}
	return str
}
