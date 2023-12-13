package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type StrikethroughParser struct{}

func NewStrikethroughParser() *StrikethroughParser {
	return &StrikethroughParser{}
}

func (*StrikethroughParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 5 {
		return 0, false
	}
	if tokens[0].Type != tokenizer.Tilde || tokens[1].Type != tokenizer.Tilde {
		return 0, false
	}

	cursor, matched := 2, false
	for ; cursor < len(tokens)-1; cursor++ {
		token, nextToken := tokens[cursor], tokens[cursor+1]
		if token.Type == tokenizer.Newline || nextToken.Type == tokenizer.Newline {
			return 0, false
		}
		if token.Type == tokenizer.Tilde && nextToken.Type == tokenizer.Tilde {
			matched = true
			break
		}
	}
	if !matched {
		return 0, false
	}
	return cursor + 2, true
}

func (p *StrikethroughParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	contentTokens := tokens[2 : size-2]
	return &ast.Strikethrough{
		Content: tokenizer.Stringify(contentTokens),
	}, nil
}
