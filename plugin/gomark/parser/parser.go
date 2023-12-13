package parser

import (
	"errors"

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

var defaultBlockParsers = []BlockParser{
	NewCodeBlockParser(),
	NewHorizontalRuleParser(),
	NewHeadingParser(),
	NewBlockquoteParser(),
	NewParagraphParser(),
	NewLineBreakParser(),
}

func Parse(tokens []*tokenizer.Token) ([]ast.Node, error) {
	nodes := []ast.Node{}
	for len(tokens) > 0 {
		for _, blockParser := range defaultBlockParsers {
			cursor, matched := blockParser.Match(tokens)
			if matched {
				node := blockParser.Parse(tokens)
				if node == nil {
					return nil, errors.New("parse error")
				}
				nodes = append(nodes, node)
				tokens = tokens[cursor:]
				break
			}
		}
	}
	return nodes, nil
}

var defaultInlineParsers = []InlineParser{
	NewBoldItalicParser(),
	NewImageParser(),
	NewLinkParser(),
	NewBoldParser(),
	NewItalicParser(),
	NewCodeParser(),
	NewTagParser(),
	NewStrikethroughParser(),
	NewTextParser(),
}

func ParseInline(tokens []*tokenizer.Token) []ast.Node {
	nodes := []ast.Node{}
	var lastNode ast.Node
	for len(tokens) > 0 {
		for _, inlineParser := range defaultInlineParsers {
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
