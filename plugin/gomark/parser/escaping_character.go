package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type EscapingCharacterParser struct{}

func NewEscapingCharacterParser() *EscapingCharacterParser {
	return &EscapingCharacterParser{}
}

func (*EscapingCharacterParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) == 0 {
		return 0, false
	}
	if tokens[0].Type != tokenizer.Backslash {
		return 0, false
	}
	if len(tokens) == 1 {
		return 0, false
	}
	if tokens[1].Type == tokenizer.Newline || tokens[1].Type == tokenizer.Space || tokens[1].Type == tokenizer.Text || tokens[1].Type == tokenizer.Number {
		return 0, false
	}
	return 2, true
}

func (p *EscapingCharacterParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	return &ast.EscapingCharacter{
		Symbol: tokens[1].Value,
	}, nil
}
