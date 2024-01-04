package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type MathParser struct{}

func NewMathParser() *MathParser {
	return &MathParser{}
}

func (*MathParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 3 {
		return 0, false
	}

	if tokens[0].Type != tokenizer.DollarSign {
		return 0, false
	}

	contentTokens := []*tokenizer.Token{}
	for _, token := range tokens[1:] {
		if token.Type == tokenizer.Newline {
			return 0, false
		}
		if token.Type == tokenizer.DollarSign {
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if len(contentTokens) == 0 {
		return 0, false
	}
	if len(contentTokens)+2 > len(tokens) {
		return 0, false
	}
	if tokens[len(contentTokens)+1].Type != tokenizer.DollarSign {
		return 0, false
	}
	return len(contentTokens) + 2, true
}

func (p *MathParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	return &ast.Math{
		Content: tokenizer.Stringify(tokens[1 : size-1]),
	}, nil
}
