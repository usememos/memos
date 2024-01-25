package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type StrikethroughParser struct{}

func NewStrikethroughParser() *StrikethroughParser {
	return &StrikethroughParser{}
}

func (*StrikethroughParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedTokens := tokenizer.GetFirstLine(tokens)
	if len(matchedTokens) < 5 {
		return nil, 0
	}
	if matchedTokens[0].Type != tokenizer.Tilde || matchedTokens[1].Type != tokenizer.Tilde {
		return nil, 0
	}

	contentTokens := []*tokenizer.Token{}
	matched := false
	for cursor := 2; cursor < len(matchedTokens)-1; cursor++ {
		token, nextToken := matchedTokens[cursor], matchedTokens[cursor+1]
		if token.Type == tokenizer.Tilde && nextToken.Type == tokenizer.Tilde {
			matched = true
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if !matched || len(contentTokens) == 0 {
		return nil, 0
	}
	return &ast.Strikethrough{
		Content: tokenizer.Stringify(contentTokens),
	}, len(contentTokens) + 4
}
