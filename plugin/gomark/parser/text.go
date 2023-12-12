package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type TextParser struct {
	Content string
}

var defaultTextParser = &TextParser{}

func NewTextParser() *TextParser {
	return defaultTextParser
}

func (*TextParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) == 0 {
		return 0, false
	}
	return 1, true
}

func (*TextParser) Parse(tokens []*tokenizer.Token) ast.Node {
	if len(tokens) == 0 {
		return ast.NewText("")
	}
	return ast.NewText(tokens[0].String())
}
