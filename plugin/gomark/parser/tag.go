package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type TagParser struct{}

func NewTagParser() *TagParser {
	return &TagParser{}
}

func (*TagParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 2 {
		return 0, false
	}
	if tokens[0].Type != tokenizer.PoundSign {
		return 0, false
	}
	contentTokens := []*tokenizer.Token{}
	for _, token := range tokens[1:] {
		if token.Type == tokenizer.Newline || token.Type == tokenizer.Space || token.Type == tokenizer.PoundSign {
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if len(contentTokens) == 0 {
		return 0, false
	}

	return len(contentTokens) + 1, true
}

func (p *TagParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	contentTokens := tokens[1:size]
	return &ast.Tag{
		Content: tokenizer.Stringify(contentTokens),
	}, nil
}
