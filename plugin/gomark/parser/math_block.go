package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type MathBlockParser struct{}

func NewMathBlockParser() *MathBlockParser {
	return &MathBlockParser{}
}

func (*MathBlockParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 7 {
		return 0, false
	}

	if tokens[0].Type != tokenizer.DollarSign || tokens[1].Type != tokenizer.DollarSign || tokens[2].Type != tokenizer.Newline {
		return 0, false
	}

	cursor := 3
	matched := false
	for ; cursor < len(tokens)-2; cursor++ {
		if tokens[cursor].Type == tokenizer.Newline && tokens[cursor+1].Type == tokenizer.DollarSign && tokens[cursor+2].Type == tokenizer.DollarSign {
			if cursor+2 == len(tokens)-1 {
				cursor += 3
				matched = true
				break
			} else if tokens[cursor+3].Type == tokenizer.Newline {
				cursor += 3
				matched = true
				break
			}
		}
	}
	if !matched {
		return 0, false
	}

	return cursor, true
}

func (p *MathBlockParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	return &ast.MathBlock{
		Content: tokenizer.Stringify(tokens[3 : size-3]),
	}, nil
}
