package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type TextParser struct {
	Content string
}

func NewTextParser() *TextParser {
	return &TextParser{}
}

func (*TextParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) == 0 {
		return 0, false
	}
	return 1, true
}

func (*TextParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	if len(tokens) == 0 {
		return &ast.Text{}, nil
	}
	return &ast.Text{
		Content: tokens[0].String(),
	}, nil
}
