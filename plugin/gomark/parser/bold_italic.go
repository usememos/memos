package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type BoldItalicParser struct{}

func NewBoldItalicParser() InlineParser {
	return &BoldItalicParser{}
}

func (*BoldItalicParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 7 {
		return 0, false
	}

	prefixTokens := tokens[:3]
	if prefixTokens[0].Type != prefixTokens[1].Type || prefixTokens[0].Type != prefixTokens[2].Type || prefixTokens[1].Type != prefixTokens[2].Type {
		return 0, false
	}
	prefixTokenType := prefixTokens[0].Type
	if prefixTokenType != tokenizer.Asterisk && prefixTokenType != tokenizer.Underscore {
		return 0, false
	}

	cursor, matched := 3, false
	for ; cursor < len(tokens)-2; cursor++ {
		token, nextToken, endToken := tokens[cursor], tokens[cursor+1], tokens[cursor+2]
		if token.Type == tokenizer.Newline || nextToken.Type == tokenizer.Newline || endToken.Type == tokenizer.Newline {
			return 0, false
		}
		if token.Type == prefixTokenType && nextToken.Type == prefixTokenType && endToken.Type == prefixTokenType {
			matched = true
			break
		}
	}
	if !matched {
		return 0, false
	}

	return cursor + 3, true
}

func (p *BoldItalicParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	prefixTokenType := tokens[0].Type
	contentTokens := tokens[3 : size-3]
	return &ast.BoldItalic{
		Symbol:  prefixTokenType,
		Content: tokenizer.Stringify(contentTokens),
	}, nil
}
