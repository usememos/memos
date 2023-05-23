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
	if len(prefixTokens) != 2 || prefixTokens[0].Type != prefixTokens[1].Type {
		return nil
	}
	prefixTokenType := prefixTokens[0].Type

	contentTokens := []*tokenizer.Token{}
	cursor := 2
	for ; cursor < len(tokens)-1; cursor++ {
		token, nextToken := tokens[cursor], tokens[cursor+1]

		if token.Type == tokenizer.Newline || nextToken.Type == tokenizer.Newline {
			break
		}
		if token.Type == prefixTokenType && nextToken.Type == prefixTokenType {
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if cursor != len(tokens)-2 {
		return nil
	}

	return &BoldParser{
		ContentTokens: contentTokens,
	}
}
