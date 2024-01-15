package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type UnorderedListParser struct{}

func NewUnorderedListParser() *UnorderedListParser {
	return &UnorderedListParser{}
}

func (*UnorderedListParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 3 {
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
	symbolToken := tokens[corsor]
	if (symbolToken.Type != tokenizer.Hyphen && symbolToken.Type != tokenizer.Asterisk && symbolToken.Type != tokenizer.PlusSign) || tokens[corsor+1].Type != tokenizer.Space {
		return 0, false
	}

	contentTokens := []*tokenizer.Token{}
	for _, token := range tokens[corsor+2:] {
		if token.Type == tokenizer.Newline {
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if len(contentTokens) == 0 {
		return 0, false
	}

	return indent + len(contentTokens) + 2, true
}

func (p *UnorderedListParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
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
	symbolToken := tokens[indent]
	contentTokens := tokens[indent+2 : size]
	children, err := ParseInline(contentTokens)
	if err != nil {
		return nil, err
	}
	return &ast.UnorderedList{
		Symbol:   symbolToken.Type,
		Indent:   indent,
		Children: children,
	}, nil
}
