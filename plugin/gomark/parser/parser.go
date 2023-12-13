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
	Parse(tokens []*tokenizer.Token) (ast.Node, error)
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
	var prevNode ast.Node
	for len(tokens) > 0 {
		for _, blockParser := range defaultBlockParsers {
			size, matched := blockParser.Match(tokens)
			if matched {
				node, err := blockParser.Parse(tokens)
				if err != nil {
					return nil, errors.New("parse error")
				}

				tokens = tokens[size:]
				if prevNode != nil {
					prevNode.SetNextSibling(node)
					node.SetPrevSibling(prevNode)
				}
				prevNode = node
				nodes = append(nodes, node)
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
	NewLineBreakParser(),
	NewTextParser(),
}

func ParseInline(parent ast.Node, tokens []*tokenizer.Token) ([]ast.Node, error) {
	nodes := []ast.Node{}
	var prevNode ast.Node
	for len(tokens) > 0 {
		for _, inlineParser := range defaultInlineParsers {
			size, matched := inlineParser.Match(tokens)
			if matched {
				node, err := inlineParser.Parse(tokens)
				if err != nil {
					return nil, errors.New("parse error")
				}

				tokens = tokens[size:]
				node.SetParent(parent)
				if prevNode != nil {
					if prevNode.Type() == ast.NodeTypeText && node.Type() == ast.NodeTypeText {
						prevNode.(*ast.Text).Content += node.(*ast.Text).Content
						break
					}

					prevNode.SetNextSibling(node)
					node.SetPrevSibling(prevNode)
				}

				nodes = append(nodes, node)
				prevNode = node
				break
			}
		}
	}
	parent.SetChildren(nodes)
	return nodes, nil
}
