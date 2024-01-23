package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type SuperscriptParser struct{}

func NewSuperscriptParser() *SuperscriptParser {
	return &SuperscriptParser{}
}

func (*SuperscriptParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedTokens := tokenizer.GetFirstLine(tokens)
	if len(matchedTokens) < 3 {
		return nil, 0
	}
	if matchedTokens[0].Type != tokenizer.Caret {
		return nil, 0
	}

	contentTokens := []*tokenizer.Token{}
	matched := false
	for _, token := range matchedTokens[1:] {
		if token.Type == tokenizer.Caret {
			matched = true
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if !matched || len(contentTokens) == 0 {
		return nil, 0
	}

	return &ast.Superscript{
		Content: tokenizer.Stringify(contentTokens),
	}, len(contentTokens) + 2
}
