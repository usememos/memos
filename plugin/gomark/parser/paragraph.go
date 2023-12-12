package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type ParagraphParser struct {
	ContentTokens []*tokenizer.Token
}

var defaultParagraphParser = &ParagraphParser{}

func NewParagraphParser() *ParagraphParser {
	return defaultParagraphParser
}

func (*ParagraphParser) Match(tokens []*tokenizer.Token) (int, bool) {
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
		return 0, false
	}
	return len(contentTokens), true
}

func (p *ParagraphParser) Parse(tokens []*tokenizer.Token) ast.Node {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil
	}

	contentTokens := tokens[:size]
	children := ParseInline(contentTokens, []InlineParser{
		NewBoldParser(),
		NewTextParser(),
	})
	return ast.NewParagraph(children)
}
