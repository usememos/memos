package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type HighlightParser struct{}

func NewHighlightParser() InlineParser {
	return &HighlightParser{}
}

func (*HighlightParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedToken := tokenizer.GetFirstLine(tokens)
	if len(matchedToken) < 5 {
		return nil, 0
	}

	prefixTokens := matchedToken[:2]
	if prefixTokens[0].Type != prefixTokens[1].Type {
		return nil, 0
	}
	prefixTokenType := prefixTokens[0].Type
	if prefixTokenType != tokenizer.EqualSign {
		return nil, 0
	}

	cursor, matched := 2, false
	for ; cursor < len(matchedToken)-1; cursor++ {
		token, nextToken := matchedToken[cursor], matchedToken[cursor+1]
		if token.Type == prefixTokenType && nextToken.Type == prefixTokenType {
			matched = true
			break
		}
	}
	if !matched {
		return nil, 0
	}

	return &ast.Highlight{
		Content: tokenizer.Stringify(matchedToken[2:cursor]),
	}, cursor + 1
}
