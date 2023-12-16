package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type BoldParser struct{}

func NewBoldParser() InlineParser {
	return &BoldParser{}
}

func (*BoldParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 5 {
		return 0, false
	}

	prefixTokens := tokens[:2]
	if prefixTokens[0].Type != prefixTokens[1].Type {
		return 0, false
	}
	prefixTokenType := prefixTokens[0].Type
	if prefixTokenType != tokenizer.Asterisk && prefixTokenType != tokenizer.Underscore {
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

func (p *BoldParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	prefixTokenType := tokens[0].Type
	contentTokens := tokens[2 : size-2]
	children, err := ParseInlineWithParsers(contentTokens, []InlineParser{NewLinkParser(), NewTextParser()})
	if err != nil {
		return nil, err
	}
	return &ast.Bold{
		Symbol:   prefixTokenType,
		Children: children,
	}, nil
}
