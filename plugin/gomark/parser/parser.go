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

func Parse(tokens []*tokenizer.Token) ([]ast.Node, error) {
	return ParseBlock(tokens)
}

var defaultBlockParsers = []BlockParser{
	NewCodeBlockParser(),
	NewTableParser(),
	NewHorizontalRuleParser(),
	NewHeadingParser(),
	NewBlockquoteParser(),
	NewTaskListParser(),
	NewUnorderedListParser(),
	NewOrderedListParser(),
	NewMathBlockParser(),
	NewParagraphParser(),
	NewLineBreakParser(),
}

func ParseBlock(tokens []*tokenizer.Token) ([]ast.Node, error) {
	return ParseBlockWithParsers(tokens, defaultBlockParsers)
}

func ParseBlockWithParsers(tokens []*tokenizer.Token, blockParsers []BlockParser) ([]ast.Node, error) {
	nodes := []ast.Node{}
	var prevNode ast.Node
	for len(tokens) > 0 {
		for _, blockParser := range blockParsers {
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
	NewEscapingCharacterParser(),
	NewBoldItalicParser(),
	NewImageParser(),
	NewLinkParser(),
	NewAutoLinkParser(),
	NewBoldParser(),
	NewItalicParser(),
	NewHighlightParser(),
	NewCodeParser(),
	NewSubscriptParser(),
	NewSuperscriptParser(),
	NewMathParser(),
	NewTagParser(),
	NewStrikethroughParser(),
	NewLineBreakParser(),
	NewTextParser(),
}

func ParseInline(tokens []*tokenizer.Token) ([]ast.Node, error) {
	return ParseInlineWithParsers(tokens, defaultInlineParsers)
}

func ParseInlineWithParsers(tokens []*tokenizer.Token, inlineParsers []InlineParser) ([]ast.Node, error) {
	nodes := []ast.Node{}
	var prevNode ast.Node
	for len(tokens) > 0 {
		for _, inlineParser := range inlineParsers {
			size, matched := inlineParser.Match(tokens)
			if matched {
				node, err := inlineParser.Parse(tokens)
				if err != nil {
					return nil, errors.New("parse error")
				}

				tokens = tokens[size:]
				if prevNode != nil {
					// Merge text nodes if possible.
					if prevNode.Type() == ast.TextNode && node.Type() == ast.TextNode {
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
	return nodes, nil
}
