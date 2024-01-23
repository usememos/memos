package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type BlockquoteParser struct{}

func NewBlockquoteParser() *BlockquoteParser {
	return &BlockquoteParser{}
}

func (*BlockquoteParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedTokens := tokenizer.GetFirstLine(tokens)
	if len(matchedTokens) < 3 {
		return nil, 0
	}
	if matchedTokens[0].Type != tokenizer.GreaterThan || matchedTokens[1].Type != tokenizer.Space {
		return nil, 0
	}

	contentTokens := matchedTokens[2:]
	children, err := ParseInlineWithParsers(contentTokens, []InlineParser{NewLinkParser(), NewTextParser()})
	if err != nil {
		return nil, 0
	}

	return &ast.Blockquote{
		Children: []ast.Node{
			&ast.Paragraph{
				Children: children,
			},
		},
	}, len(matchedTokens)
}
