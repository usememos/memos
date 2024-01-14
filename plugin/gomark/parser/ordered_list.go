package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type OrderedListParser struct{}

func NewOrderedListParser() *OrderedListParser {
	return &OrderedListParser{}
}

func (*OrderedListParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 4 {
		return 0, false
	}

	indent := 0
	for _, token := range tokens {
		if token.Type == tokenizer.Space {
			indent++
		} else {
			break
		}
	}
	corsor := indent
	if tokens[corsor].Type != tokenizer.Number || tokens[corsor+1].Type != tokenizer.Dot || tokens[corsor+2].Type != tokenizer.Space {
		return 0, false
	}

	contentTokens := []*tokenizer.Token{}
	for _, token := range tokens[corsor+3:] {
		if token.Type == tokenizer.Newline {
			break
		}
		contentTokens = append(contentTokens, token)
	}

	if len(contentTokens) == 0 {
		return 0, false
	}

	return indent + len(contentTokens) + 3, true
}

func (p *OrderedListParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	indent := 0
	for _, token := range tokens {
		if token.Type == tokenizer.Space {
			indent++
		} else {
			break
		}
	}
	contentTokens := tokens[indent+3 : size]
	children, err := ParseInline(contentTokens)
	if err != nil {
		return nil, err
	}
	return &ast.OrderedList{
		Number:   tokens[indent].Value,
		Indent:   indent,
		Children: children,
	}, nil
}
