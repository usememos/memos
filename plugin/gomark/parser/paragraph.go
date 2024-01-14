package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type ParagraphParser struct {
	ContentTokens []*tokenizer.Token
}

func NewParagraphParser() *ParagraphParser {
	return &ParagraphParser{}
}

func (*ParagraphParser) Match(tokens []*tokenizer.Token) (int, bool) {
	contentTokens := []*tokenizer.Token{}
	for _, token := range tokens {
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

func (p *ParagraphParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	children, err := ParseInline(tokens[:size])
	if err != nil {
		return nil, err
	}
	return &ast.Paragraph{
		Children: children,
	}, nil
}
