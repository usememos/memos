package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type Context struct {
	BlockParsers  []BlockParser
	InlineParsers []InlineParser
}

type BaseParser interface {
	Match(tokens []*tokenizer.Token) (int, bool)
	Parse(tokens []*tokenizer.Token) ast.Node
}

type InlineParser interface {
	BaseParser
}

type BlockParser interface {
	BaseParser
}

func Parse(tokens []*tokenizer.Token) []ast.Node {
	nodes := []ast.Node{}
	blockParsers := []BlockParser{
		NewCodeBlockParser(),
		NewParagraphParser(),
		NewLineBreakParser(),
	}
	for len(tokens) > 0 {
		for _, blockParser := range blockParsers {
			cursor, matched := blockParser.Match(tokens)
			if matched {
				node := blockParser.Parse(tokens)
				nodes = append(nodes, node)
				tokens = tokens[cursor:]
				break
			}
		}
	}
	return nodes
}

func ParseInline(tokens []*tokenizer.Token, inlineParsers []InlineParser) []ast.Node {
	nodes := []ast.Node{}
	var lastNode ast.Node
	for len(tokens) > 0 {
		for _, inlineParser := range inlineParsers {
			cursor, matched := inlineParser.Match(tokens)
			if matched {
				node := inlineParser.Parse(tokens)
				if node.Type() == ast.NodeTypeText && lastNode != nil && lastNode.Type() == ast.NodeTypeText {
					lastNode.(*ast.Text).Content += node.(*ast.Text).Content
				} else {
					nodes = append(nodes, node)
					lastNode = node
				}
				tokens = tokens[cursor:]
				break
			}
		}
	}
	return nodes
}
