package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type LinkParser struct{}

func NewLinkParser() *LinkParser {
	return &LinkParser{}
}

func (*LinkParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedTokens := tokenizer.GetFirstLine(tokens)
	if len(matchedTokens) < 5 {
		return nil, 0
	}
	if matchedTokens[0].Type != tokenizer.LeftSquareBracket {
		return nil, 0
	}

	textTokens := []*tokenizer.Token{}
	for _, token := range matchedTokens[1:] {
		if token.Type == tokenizer.RightSquareBracket {
			break
		}
		textTokens = append(textTokens, token)
	}
	if len(textTokens)+4 >= len(matchedTokens) {
		return nil, 0
	}
	if matchedTokens[2+len(textTokens)].Type != tokenizer.LeftParenthesis {
		return nil, 0
	}
	urlTokens := []*tokenizer.Token{}
	for _, token := range matchedTokens[3+len(textTokens):] {
		if token.Type == tokenizer.Space {
			return nil, 0
		}
		if token.Type == tokenizer.RightParenthesis {
			break
		}
		urlTokens = append(urlTokens, token)
	}
	if 4+len(urlTokens)+len(textTokens) > len(matchedTokens) {
		return nil, 0
	}

	return &ast.Link{
		Text: tokenizer.Stringify(textTokens),
		URL:  tokenizer.Stringify(urlTokens),
	}, 4 + len(urlTokens) + len(textTokens)
}
