package ast

type BaseBlock struct {
}

type LineBreak struct {
	BaseBlock
}

var NodeTypeLineBreak = NewNodeType("LineBreak")

func (*LineBreak) Type() NodeType {
	return NodeTypeLineBreak
}

type Paragraph struct {
	BaseBlock

	Children []Node
}

var NodeTypeParagraph = NewNodeType("Paragraph")

func (*Paragraph) Type() NodeType {
	return NodeTypeParagraph
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

type Heading struct {
	BaseBlock

	Level    int
	Children []Node
}

var NodeTypeHeading = NewNodeType("Heading")

func (*Heading) Type() NodeType {
	return NodeTypeHeading
}
