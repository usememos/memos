package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type LinkParser struct{}

func NewLinkParser() *LinkParser {
	return &LinkParser{}
}

func (*LinkParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 5 {
		return 0, false
	}
	if tokens[0].Type != tokenizer.LeftSquareBracket {
		return 0, false
	}
	textTokens := []*tokenizer.Token{}
	for _, token := range tokens[1:] {
		if token.Type == tokenizer.Newline {
			return 0, false
		}
		if token.Type == tokenizer.RightSquareBracket {
			break
		}
		textTokens = append(textTokens, token)
	}
	if len(textTokens)+4 >= len(tokens) {
		return 0, false
	}
	if tokens[2+len(textTokens)].Type != tokenizer.LeftParenthesis {
		return 0, false
	}
	urlTokens := []*tokenizer.Token{}
	for _, token := range tokens[3+len(textTokens):] {
		if token.Type == tokenizer.Newline || token.Type == tokenizer.Space {
			return 0, false
		}
		if token.Type == tokenizer.RightParenthesis {
			break
		}
		urlTokens = append(urlTokens, token)
	}
	if 4+len(urlTokens)+len(textTokens) > len(tokens) {
		return 0, false
	}

	return 4 + len(urlTokens) + len(textTokens), true
}

func (p *LinkParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	textTokens := []*tokenizer.Token{}
	for _, token := range tokens[1:] {
		if token.Type == tokenizer.RightSquareBracket {
			break
		}
		textTokens = append(textTokens, token)
	}
	urlTokens := tokens[2+len(textTokens)+1 : size-1]
	return &ast.Link{
		Text: tokenizer.Stringify(textTokens),
		URL:  tokenizer.Stringify(urlTokens),
	}, nil
}
