package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type HighlightParser struct{}

func NewHighlightParser() InlineParser {
	return &HighlightParser{}
}

func (*HighlightParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 5 {
		return 0, false
	}

	prefixTokens := tokens[:2]
	if prefixTokens[0].Type != prefixTokens[1].Type {
		return 0, false
	}
	prefixTokenType := prefixTokens[0].Type
	if prefixTokenType != tokenizer.EqualSign {
		return 0, false
	}

	cursor, matched := 2, false
	for ; cursor < len(tokens)-1; cursor++ {
		token, nextToken := tokens[cursor], tokens[cursor+1]
		if token.Type == tokenizer.Newline || nextToken.Type == tokenizer.Newline {
			return 0, false
		}
		if token.Type == prefixTokenType && nextToken.Type == prefixTokenType {
			matched = true
			break
		}
	}
	if !matched {
		return 0, false
	}

	return cursor + 2, true
}

func (p *HighlightParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	contentTokens := tokens[2 : size-2]
	return &ast.Highlight{
		Content: tokenizer.Stringify(contentTokens),
	}, nil
}
