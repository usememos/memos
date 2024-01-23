package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type EscapingCharacterParser struct{}

func NewEscapingCharacterParser() *EscapingCharacterParser {
	return &EscapingCharacterParser{}
}

func (*EscapingCharacterParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	if len(tokens) < 2 {
		return nil, 0
	}
	if tokens[0].Type != tokenizer.Backslash {
		return nil, 0
	}
	if tokens[1].Type == tokenizer.Newline || tokens[1].Type == tokenizer.Space || tokens[1].Type == tokenizer.Text || tokens[1].Type == tokenizer.Number {
		return nil, 0
	}
	return &ast.EscapingCharacter{
		Symbol: tokens[1].Value,
	}, 2
}
