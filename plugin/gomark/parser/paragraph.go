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
		contentTokens = append(contentTokens, token)
		if token.Type == tokenizer.Newline {
			break
		}
	}
	if len(contentTokens) == 0 {
		return 0, false
	}
	if len(contentTokens) == 1 && contentTokens[0].Type == tokenizer.Newline {
		return 0, false
	}
	return len(contentTokens), true
}

func (p *ParagraphParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	contentTokens := tokens[:size]
	children, err := ParseInline(contentTokens)
	if err != nil {
		return nil, err
	}
	return &ast.Paragraph{
		Children: children,
	}, nil
}
