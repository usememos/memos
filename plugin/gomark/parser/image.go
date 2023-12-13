package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type ImageParser struct{}

func NewImageParser() *ImageParser {
	return &ImageParser{}
}

func (*ImageParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 5 {
		return 0, false
	}
	if tokens[0].Type != tokenizer.ExclamationMark {
		return 0, false
	}
	if tokens[1].Type != tokenizer.LeftSquareBracket {
		return 0, false
	}
	cursor, altText := 2, ""
	for ; cursor < len(tokens)-2; cursor++ {
		if tokens[cursor].Type == tokenizer.Newline {
			return 0, false
		}
		if tokens[cursor].Type == tokenizer.RightSquareBracket {
			break
		}
		altText += tokens[cursor].Value
	}
	if tokens[cursor+1].Type != tokenizer.LeftParenthesis {
		return 0, false
	}
	cursor += 2
	contentTokens, matched := []*tokenizer.Token{}, false
	for _, token := range tokens[cursor:] {
		if token.Type == tokenizer.Newline || token.Type == tokenizer.Space {
			return 0, false
		}
		if token.Type == tokenizer.RightParenthesis {
			matched = true
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if !matched || len(contentTokens) == 0 {
		return 0, false
	}
	return cursor + len(contentTokens) + 1, true
}

func (p *ImageParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	altTextTokens := []*tokenizer.Token{}
	for _, token := range tokens[2:] {
		if token.Type == tokenizer.RightSquareBracket {
			break
		}
		altTextTokens = append(altTextTokens, token)
	}
	contentTokens := tokens[2+len(altTextTokens)+2 : size-1]
	return &ast.Image{
		AltText: tokenizer.Stringify(altTextTokens),
		URL:     tokenizer.Stringify(contentTokens),
	}, nil
}
