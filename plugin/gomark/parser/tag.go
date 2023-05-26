package parser

import "github.com/usememos/memos/plugin/gomark/parser/tokenizer"

type TagParser struct {
	ContentTokens []*tokenizer.Token
}

func NewTagParser() *TagParser {
	return &TagParser{}
}

func (*TagParser) Match(tokens []*tokenizer.Token) *TagParser {
	if len(tokens) < 2 {
		return nil
	}
	if tokens[0].Type != tokenizer.Hash {
		return nil
	}
	contentTokens := []*tokenizer.Token{}
	for _, token := range tokens[1:] {
		if token.Type == tokenizer.Newline || token.Type == tokenizer.Space || token.Type == tokenizer.Hash {
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if len(contentTokens) == 0 {
		return nil
	}

	return &TagParser{
		ContentTokens: contentTokens,
	}
}
