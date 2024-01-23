package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type ItalicParser struct {
	ContentTokens []*tokenizer.Token
}

func NewItalicParser() *ItalicParser {
	return &ItalicParser{}
}

func (*ItalicParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedTokens := tokenizer.GetFirstLine(tokens)
	if len(matchedTokens) < 3 {
		return nil, 0
	}

	prefixTokens := matchedTokens[:1]
	if prefixTokens[0].Type != tokenizer.Asterisk && prefixTokens[0].Type != tokenizer.Underscore {
		return nil, 0
	}
	prefixTokenType := prefixTokens[0].Type
	contentTokens := []*tokenizer.Token{}
	matched := false
	for _, token := range matchedTokens[1:] {
		if token.Type == prefixTokenType {
			matched = true
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if !matched || len(contentTokens) == 0 {
		return nil, 0
	}

	return &ast.Italic{
		Symbol:  prefixTokenType,
		Content: tokenizer.Stringify(contentTokens),
	}, len(contentTokens) + 2
}
