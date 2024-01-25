package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type BoldItalicParser struct{}

func NewBoldItalicParser() InlineParser {
	return &BoldItalicParser{}
}

func (*BoldItalicParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedTokens := tokenizer.GetFirstLine(tokens)
	if len(matchedTokens) < 7 {
		return nil, 0
	}
	prefixTokens := matchedTokens[:3]
	if prefixTokens[0].Type != prefixTokens[1].Type || prefixTokens[0].Type != prefixTokens[2].Type || prefixTokens[1].Type != prefixTokens[2].Type {
		return nil, 0
	}
	prefixTokenType := prefixTokens[0].Type
	if prefixTokenType != tokenizer.Asterisk && prefixTokenType != tokenizer.Underscore {
		return nil, 0
	}

	cursor, matched := 3, false
	for ; cursor < len(matchedTokens)-2; cursor++ {
		token, nextToken, endToken := matchedTokens[cursor], matchedTokens[cursor+1], matchedTokens[cursor+2]
		if token.Type == tokenizer.Newline || nextToken.Type == tokenizer.Newline || endToken.Type == tokenizer.Newline {
			return nil, 0
		}
		if token.Type == prefixTokenType && nextToken.Type == prefixTokenType && endToken.Type == prefixTokenType {
			matchedTokens = matchedTokens[:cursor+3]
			matched = true
			break
		}
	}
	if !matched {
		return nil, 0
	}

	size := len(matchedTokens)
	return &ast.BoldItalic{
		Symbol:  prefixTokenType,
		Content: tokenizer.Stringify(matchedTokens[3 : size-3]),
	}, len(matchedTokens)
}
