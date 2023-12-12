package ast

type BaseBlock struct {
}

type Paragraph struct {
	BaseBlock

	Children []Node
}

var NodeTypeParagraph = NewNodeType("Paragraph")

func NewParagraph(children []Node) *Paragraph {
	return &Paragraph{
		Children: children,
	}
}

func (*Paragraph) Type() NodeType {
	return NodeTypeParagraph
}

type CodeBlock struct {
	BaseBlock

	Language string
	Content  string
}

var NodeTypeCodeBlock = NewNodeType("CodeBlock")

func NewCodeBlock(language, content string) *CodeBlock {
	return &CodeBlock{
		Language: language,
		Content:  content,
	}
}

func (*CodeBlock) Type() NodeType {
	return NodeTypeCodeBlock
}
