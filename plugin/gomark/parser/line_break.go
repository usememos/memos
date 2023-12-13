package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type LineBreakParser struct{}

func NewLineBreakParser() *LineBreakParser {
	return &LineBreakParser{}
}

func (*LineBreakParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) == 0 {
		return 0, false
	}
	if tokens[0].Type != tokenizer.Newline {
		return 0, false
	}
	return 1, true
}

func (p *LineBreakParser) Parse(tokens []*tokenizer.Token) ast.Node {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil
	}

	return &ast.LineBreak{}
}
