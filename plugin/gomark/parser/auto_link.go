package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type AutoLinkParser struct{}

func NewAutoLinkParser() *AutoLinkParser {
	return &AutoLinkParser{}
}

func (*AutoLinkParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 3 {
		return 0, false
	}
	if tokens[0].Type != tokenizer.LessThan {
		return 0, false
	}
	urlTokens := []*tokenizer.Token{}
	for _, token := range tokens[1:] {
		if token.Type == tokenizer.Newline || token.Type == tokenizer.Space {
			return 0, false
		}
		if token.Type == tokenizer.GreaterThan {
			break
		}
		urlTokens = append(urlTokens, token)
	}
	if 2+len(urlTokens) > len(tokens) {
		return 0, false
	}

	return 2 + len(urlTokens), true
}

func (p *AutoLinkParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	urlTokens := tokens[1 : size-1]
	return &ast.AutoLink{
		URL: tokenizer.Stringify(urlTokens),
	}, nil
}
