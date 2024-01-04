package ast

import "fmt"

type BaseBlock struct {
	BaseNode
}

type LineBreak struct {
	BaseBlock
}

func (*LineBreak) Type() NodeType {
	return LineBreakNode
}

func (*LineBreak) Restore() string {
	return "\n"
}

type Paragraph struct {
	BaseBlock

	Children []Node
}

func (*Paragraph) Type() NodeType {
	return ParagraphNode
}

func (n *Paragraph) Restore() string {
	var result string
	for _, child := range n.Children {
		result += child.Restore()
	}
	return result
}

type CodeBlock struct {
	BaseBlock

	Language string
	Content  string
}

func (*CodeBlock) Type() NodeType {
	return CodeBlockNode
}

func (n *CodeBlock) Restore() string {
	return fmt.Sprintf("```%s\n%s\n```", n.Language, n.Content)
}

type Heading struct {
	BaseBlock

	Level    int
	Children []Node
}

func (*Heading) Type() NodeType {
	return HeadingNode
}

func (n *Heading) Restore() string {
	var result string
	for _, child := range n.Children {
		result += child.Restore()
	}
	symbol := ""
	for i := 0; i < n.Level; i++ {
		symbol += "#"
	}
	return fmt.Sprintf("%s %s", symbol, result)
}

type HorizontalRule struct {
	BaseBlock

	// Symbol is "*" or "-" or "_".
	Symbol string
}

func (*HorizontalRule) Type() NodeType {
	return HorizontalRuleNode
}

func (n *HorizontalRule) Restore() string {
	return n.Symbol + n.Symbol + n.Symbol
}

type Blockquote struct {
	BaseBlock

	Children []Node
}

func (*Blockquote) Type() NodeType {
	return BlockquoteNode
}

func (n *Blockquote) Restore() string {
	var result string
	for _, child := range n.Children {
		result += child.Restore()
	}
	return fmt.Sprintf("> %s", result)
}

type OrderedList struct {
	BaseBlock

	Number   string
	Children []Node
}

func (*OrderedList) Type() NodeType {
	return OrderedListNode
}

func (n *OrderedList) Restore() string {
	var result string
	for _, child := range n.Children {
		result += child.Restore()
	}
	return fmt.Sprintf("%s. %s", n.Number, result)
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

func (n *UnorderedList) Restore() string {
	var result string
	for _, child := range n.Children {
		result += child.Restore()
	}
	return fmt.Sprintf("%s %s", n.Symbol, result)
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

func (n *TaskList) Restore() string {
	var result string
	for _, child := range n.Children {
		result += child.Restore()
	}
	complete := " "
	if n.Complete {
		complete = "x"
	}
	return fmt.Sprintf("%s [%s] %s", n.Symbol, complete, result)
}

type MathBlock struct {
	BaseBlock

	Content string
}

func (*MathBlock) Type() NodeType {
	return MathBlockNode
}

func (n *MathBlock) Restore() string {
	return fmt.Sprintf("$$\n%s\n$$", n.Content)
}
