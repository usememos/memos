package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type HeadingParser struct{}

func NewHeadingParser() *HeadingParser {
	return &HeadingParser{}
}

func (*HeadingParser) Match(tokens []*tokenizer.Token) (int, bool) {
	level := 0
	for _, token := range tokens {
		if token.Type == tokenizer.PoundSign {
			level++
		} else {
			break
		}
	}
	if len(tokens) <= level+1 {
		return 0, false
	}
	if tokens[level].Type != tokenizer.Space {
		return 0, false
	}
	if level == 0 || level > 6 {
		return 0, false
	}

	contentTokens := []*tokenizer.Token{}
	for _, token := range tokens[level+1:] {
		if token.Type == tokenizer.Newline {
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if len(contentTokens) == 0 {
		return 0, false
	}

	return len(contentTokens) + level + 1, true
}

func (p *HeadingParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	level := 0
	for _, token := range tokens {
		if token.Type == tokenizer.PoundSign {
			level++
		} else {
			break
		}
	}

	contentTokens := tokens[level+1 : size]
	children, err := ParseInline(contentTokens)
	if err != nil {
		return nil, err
	}
	return &ast.Heading{
		Level:    level,
		Children: children,
	}, nil
}
