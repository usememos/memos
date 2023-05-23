package parser

import (
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type HeadingParser struct {
	Level         int
	ContentTokens []*tokenizer.Token
}

func NewHeadingParser() *HeadingParser {
	return &HeadingParser{}
}

func (*HeadingParser) Match(tokens []*tokenizer.Token) *HeadingParser {
	cursor := 0
	for _, token := range tokens {
		if token.Type == tokenizer.Hash {
			cursor++
		} else {
			break
		}
	}
	if len(tokens) <= cursor+1 {
		return nil
	}
	if tokens[cursor].Type != tokenizer.Space {
		return nil
	}
	level := cursor
	if level == 0 || level > 6 {
		return nil
	}

	cursor++
	contentTokens := []*tokenizer.Token{}
	for _, token := range tokens[cursor:] {
		if token.Type == tokenizer.Newline {
			break
		}
		contentTokens = append(contentTokens, token)
		cursor++
	}
	if len(contentTokens) == 0 {
		return nil
	}

	return &HeadingParser{
		Level:         level,
		ContentTokens: contentTokens,
	}
}
