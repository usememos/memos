package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type EmbeddedContentParser struct{}

func NewEmbeddedContentParser() *EmbeddedContentParser {
	return &EmbeddedContentParser{}
}

func (*EmbeddedContentParser) Match(tokens []*tokenizer.Token) (int, bool) {
	lines := tokenizer.Split(tokens, tokenizer.Newline)
	if len(lines) < 1 {
		return 0, false
	}
	firstLine := lines[0]
	if len(firstLine) < 5 {
		return 0, false
	}
	if firstLine[0].Type != tokenizer.ExclamationMark || firstLine[1].Type != tokenizer.LeftSquareBracket || firstLine[2].Type != tokenizer.LeftSquareBracket {
		return 0, false
	}
	matched := false
	for index, token := range firstLine[:len(firstLine)-1] {
		if token.Type == tokenizer.RightSquareBracket && firstLine[index+1].Type == tokenizer.RightSquareBracket && index+1 == len(firstLine)-1 {
			matched = true
			break
		}
	}
	if !matched {
		return 0, false
	}

	return len(firstLine), true
}

func (p *EmbeddedContentParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	return &ast.EmbeddedContent{
		ResourceName: tokenizer.Stringify(tokens[3 : size-2]),
	}, nil
}
