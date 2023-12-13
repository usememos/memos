package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type BlockquoteParser struct{}

func NewBlockquoteParser() *BlockquoteParser {
	return &BlockquoteParser{}
}

func (*BlockquoteParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 4 {
		return 0, false
	}
	if tokens[0].Type != tokenizer.GreaterThan || tokens[1].Type != tokenizer.Space {
		return 0, false
	}

	contentTokens := []*tokenizer.Token{}
	for _, token := range tokens[2:] {
		if token.Type == tokenizer.Newline {
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if len(contentTokens) == 0 {
		return 0, false
	}

	return len(contentTokens) + 2, true
}

func (p *BlockquoteParser) Parse(tokens []*tokenizer.Token) ast.Node {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil
	}

	contentTokens := tokens[2:size]
	children := ParseInline(contentTokens)
	return &ast.Blockquote{
		Children: children,
	}
}
