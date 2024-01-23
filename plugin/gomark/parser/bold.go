package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type BoldParser struct{}

func NewBoldParser() InlineParser {
	return &BoldParser{}
}

func (*BoldParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedTokens := tokenizer.GetFirstLine(tokens)
	if len(matchedTokens) < 5 {
		return nil, 0
	}

	prefixTokens := matchedTokens[:2]
	if prefixTokens[0].Type != prefixTokens[1].Type {
		return nil, 0
	}
	prefixTokenType := prefixTokens[0].Type
	if prefixTokenType != tokenizer.Asterisk && prefixTokenType != tokenizer.Underscore {
		return nil, 0
	}

	cursor, matched := 2, false
	for ; cursor < len(matchedTokens)-1; cursor++ {
		token, nextToken := matchedTokens[cursor], matchedTokens[cursor+1]
		if token.Type == tokenizer.Newline || nextToken.Type == tokenizer.Newline {
			return nil, 0
		}
		if token.Type == prefixTokenType && nextToken.Type == prefixTokenType {
			matchedTokens = matchedTokens[:cursor+2]
			matched = true
			break
		}
	}
	if !matched {
		return nil, 0
	}

	size := len(matchedTokens)
	children, err := ParseInlineWithParsers(matchedTokens[2:size-2], []InlineParser{NewLinkParser(), NewTextParser()})
	if err != nil {
		return nil, 0
	}
	return &ast.Bold{
		Symbol:   prefixTokenType,
		Children: children,
	}, size
}
