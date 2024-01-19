package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type SuperscriptParser struct{}

func NewSuperscriptParser() *SuperscriptParser {
	return &SuperscriptParser{}
}

func (*SuperscriptParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 3 {
		return 0, false
	}
	if tokens[0].Type != tokenizer.Caret {
		return 0, false
	}

	contentTokens := []*tokenizer.Token{}
	matched := false
	for _, token := range tokens[1:] {
		if token.Type == tokenizer.Newline {
			return 0, false
		}
		if token.Type == tokenizer.Caret {
			matched = true
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if !matched || len(contentTokens) == 0 {
		return 0, false
	}

	return len(contentTokens) + 2, true
}

func (p *SuperscriptParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	contentTokens := tokens[1 : size-1]
	return &ast.Superscript{
		Content: tokenizer.Stringify(contentTokens),
	}, nil
}
