package parser

import (
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type BoldParser struct {
	ContentTokens []*tokenizer.Token
}

func NewBoldParser() *BoldParser {
	return &BoldParser{}
}

func (*BoldParser) Match(tokens []*tokenizer.Token) *BoldParser {
	if len(tokens) < 5 {
		return nil
	}

	prefixTokens := tokens[:2]
	if prefixTokens[0].Type != prefixTokens[1].Type {
		return nil
	}
	prefixTokenType := prefixTokens[0].Type
	if prefixTokenType != tokenizer.Star && prefixTokenType != tokenizer.Underline {
		return nil
	}

	contentTokens := []*tokenizer.Token{}
	cursor, matched := 2, false
	for ; cursor < len(tokens)-1; cursor++ {
		token, nextToken := tokens[cursor], tokens[cursor+1]
		if token.Type == tokenizer.Newline || nextToken.Type == tokenizer.Newline {
			return nil
		}
		if token.Type == prefixTokenType && nextToken.Type == prefixTokenType {
			matched = true
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if !matched {
		return nil
	}

	return &BoldParser{
		ContentTokens: contentTokens,
	}
}
