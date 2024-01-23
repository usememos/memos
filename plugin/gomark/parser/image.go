package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type ImageParser struct{}

func NewImageParser() *ImageParser {
	return &ImageParser{}
}

func (*ImageParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedTokens := tokenizer.GetFirstLine(tokens)
	if len(matchedTokens) < 5 {
		return nil, 0
	}
	if matchedTokens[0].Type != tokenizer.ExclamationMark {
		return nil, 0
	}
	if matchedTokens[1].Type != tokenizer.LeftSquareBracket {
		return nil, 0
	}
	cursor, altTokens := 2, []*tokenizer.Token{}
	for ; cursor < len(matchedTokens)-2; cursor++ {
		if matchedTokens[cursor].Type == tokenizer.RightSquareBracket {
			break
		}
		altTokens = append(altTokens, matchedTokens[cursor])
	}
	if matchedTokens[cursor+1].Type != tokenizer.LeftParenthesis {
		return nil, 0
	}

	cursor += 2
	contentTokens, matched := []*tokenizer.Token{}, false
	for _, token := range matchedTokens[cursor:] {
		if token.Type == tokenizer.Space {
			return nil, 0
		}
		if token.Type == tokenizer.RightParenthesis {
			matched = true
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if !matched || len(contentTokens) == 0 {
		return nil, 0
	}

	return &ast.Image{
		AltText: tokenizer.Stringify(altTokens),
		URL:     tokenizer.Stringify(contentTokens),
	}, 0
}
