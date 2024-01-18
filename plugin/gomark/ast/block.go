package ast

import (
	"fmt"
	"strings"
)

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

	// Number is the number of the list.
	Number string
	// Indent is the number of spaces.
	Indent   int
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
	return fmt.Sprintf("%s%s. %s", strings.Repeat(" ", n.Indent), n.Number, result)
}

type UnorderedList struct {
	BaseBlock

	// Symbol is "*" or "-" or "+".
	Symbol string
	// Indent is the number of spaces.
	Indent   int
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
	return fmt.Sprintf("%s%s %s", strings.Repeat(" ", n.Indent), n.Symbol, result)
}

type TaskList struct {
	BaseBlock

	// Symbol is "*" or "-" or "+".
	Symbol string
	// Indent is the number of spaces.
	Indent   int
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
	return fmt.Sprintf("%s%s [%s] %s", strings.Repeat(" ", n.Indent), n.Symbol, complete, result)
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

type Table struct {
	BaseBlock

	Header    []string
	Delimiter []string
	Rows      [][]string
}

func (*Table) Type() NodeType {
	return TableNode
}

func (n *Table) Restore() string {
	var result string
	for _, header := range n.Header {
		result += fmt.Sprintf("| %s ", header)
	}
	result += "|\n"
	for _, d := range n.Delimiter {
		result += fmt.Sprintf("| %s ", d)
	}
	result += "|\n"
	for index, row := range n.Rows {
		for _, cell := range row {
			result += fmt.Sprintf("| %s ", cell)
		}
		result += "|"
		if index != len(n.Rows)-1 {
			result += "\n"
		}
	}
	return result
}
