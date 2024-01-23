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

func (*TextParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	if len(tokens) == 0 {
		return nil, 0
	}
	return &ast.Text{
		Content: tokens[0].String(),
	}, 1
}
