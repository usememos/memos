package parser

import "github.com/usememos/memos/plugin/gomark/parser/tokenizer"

type ItalicParser struct {
	ContentTokens []*tokenizer.Token
}

func NewItalicParser() *ItalicParser {
	return &ItalicParser{}
}

func (*ItalicParser) Match(tokens []*tokenizer.Token) *ItalicParser {
	if len(tokens) < 3 {
		return nil
	}

	prefixTokens := tokens[:1]
	if prefixTokens[0].Type != tokenizer.Star && prefixTokens[0].Type != tokenizer.Underline {
		return nil
	}
	prefixTokenType := prefixTokens[0].Type
	contentTokens := []*tokenizer.Token{}
	matched := false
	for _, token := range tokens[1:] {
		if token.Type == tokenizer.Newline {
			return nil
		}
		if token.Type == prefixTokenType {
			matched = true
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if !matched || len(contentTokens) == 0 {
		return nil
	}

	return &ItalicParser{
		ContentTokens: contentTokens,
	}
}
