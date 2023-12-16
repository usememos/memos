package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type ItalicParser struct {
	ContentTokens []*tokenizer.Token
}

func NewItalicParser() *ItalicParser {
	return &ItalicParser{}
}

func (*ItalicParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 3 {
		return 0, false
	}

	prefixTokens := tokens[:1]
	if prefixTokens[0].Type != tokenizer.Asterisk && prefixTokens[0].Type != tokenizer.Underscore {
		return 0, false
	}
	prefixTokenType := prefixTokens[0].Type
	contentTokens := []*tokenizer.Token{}
	matched := false
	for _, token := range tokens[1:] {
		if token.Type == tokenizer.Newline {
			return 0, false
		}
		if token.Type == prefixTokenType {
			matched = true
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if !matched || len(contentTokens) == 0 {
		return 0, false
	}

	return len(contentTokens) + 2, true
}

func (p *ItalicParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	prefixTokenType := tokens[0].Type
	contentTokens := tokens[1 : size-1]
	return &ast.Italic{
		Symbol:  prefixTokenType,
		Content: tokenizer.Stringify(contentTokens),
	}, nil
}
