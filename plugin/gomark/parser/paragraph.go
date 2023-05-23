package parser

import "github.com/usememos/memos/plugin/gomark/parser/tokenizer"

type ParagraphParser struct {
	ContentTokens []*tokenizer.Token
}

func NewParagraphParser() *ParagraphParser {
	return &ParagraphParser{}
}

func (*ParagraphParser) Match(tokens []*tokenizer.Token) *ParagraphParser {
	contentTokens := []*tokenizer.Token{}
	cursor := 0
	for ; cursor < len(tokens); cursor++ {
		token := tokens[cursor]
		if token.Type == tokenizer.Newline {
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if len(contentTokens) == 0 {
		return nil
	}

	return &ParagraphParser{
		ContentTokens: contentTokens,
	}
}
