package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type SubscriptParser struct{}

func NewSubscriptParser() *SubscriptParser {
	return &SubscriptParser{}
}

func (*SubscriptParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedTokens := tokenizer.GetFirstLine(tokens)
	if len(matchedTokens) < 3 {
		return nil, 0
	}
	if matchedTokens[0].Type != tokenizer.Tilde {
		return nil, 0
	}

	contentTokens := []*tokenizer.Token{}
	matched := false
	for _, token := range matchedTokens[1:] {
		if token.Type == tokenizer.Tilde {
			matched = true
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if !matched || len(contentTokens) == 0 {
		return nil, 0
	}

	return &ast.Subscript{
		Content: tokenizer.Stringify(contentTokens),
	}, len(contentTokens) + 2
}
