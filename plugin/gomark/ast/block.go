package ast

type BaseBlock struct {
	BaseNode
}

type LineBreak struct {
	BaseBlock
}

func (*LineBreak) Type() NodeType {
	return LineBreakNode
}

type Paragraph struct {
	BaseBlock

	Children []Node
}

func (*Paragraph) Type() NodeType {
	return ParagraphNode
}

type CodeBlock struct {
	BaseBlock

	Language string
	Content  string
}

func (*CodeBlock) Type() NodeType {
	return CodeBlockNode
}

type Heading struct {
	BaseBlock

	Level    int
	Children []Node
}

func (*Heading) Type() NodeType {
	return HeadingNode
}

type HorizontalRule struct {
	BaseBlock

	// Symbol is "*" or "-" or "_".
	Symbol string
}

func (*HorizontalRule) Type() NodeType {
	return HorizontalRuleNode
}

type Blockquote struct {
	BaseBlock

	Children []Node
}

func (*Blockquote) Type() NodeType {
	return BlockquoteNode
}

type OrderedList struct {
	BaseBlock

	Number   string
	Children []Node
}

func (*OrderedList) Type() NodeType {
	return OrderedListNode
}

type UnorderedList struct {
	BaseBlock

	// Symbol is "*" or "-" or "+".
	Symbol   string
	Children []Node
}

func (*UnorderedList) Type() NodeType {
	return UnorderedListNode
}

type TaskList struct {
	BaseBlock

	// Symbol is "*" or "-" or "+".
	Symbol   string
	Complete bool
	Children []Node
}

func (*TaskList) Type() NodeType {
	return TaskListNode
}
