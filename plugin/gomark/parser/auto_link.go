package parser

import (
	"errors"
	"net/url"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type AutoLinkParser struct{}

func NewAutoLinkParser() *AutoLinkParser {
	return &AutoLinkParser{}
}

func (*AutoLinkParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 3 {
		return 0, false
	}

	hasAngleBrackets := false
	if tokens[0].Type == tokenizer.LessThan {
		hasAngleBrackets = true
	}

	contentTokens := []*tokenizer.Token{}
	for _, token := range tokens {
		if token.Type == tokenizer.Newline || token.Type == tokenizer.Space {
			break
		}
		contentTokens = append(contentTokens, token)
		if hasAngleBrackets && token.Type == tokenizer.GreaterThan {
			break
		}
	}

	if hasAngleBrackets && contentTokens[len(contentTokens)-1].Type != tokenizer.GreaterThan {
		return 0, false
	}

	content := tokenizer.Stringify(contentTokens)
	if !hasAngleBrackets {
		u, err := url.Parse(content)
		if err != nil || u.Scheme == "" || u.Host == "" {
			return 0, false
		}
	}

	return len(contentTokens), true
}

func (p *AutoLinkParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	url := tokenizer.Stringify(tokens[:size])
	isRawText := true
	if tokens[0].Type == tokenizer.LessThan && tokens[size-1].Type == tokenizer.GreaterThan {
		isRawText = false
		url = tokenizer.Stringify(tokens[1 : size-1])
	}
	return &ast.AutoLink{
		URL:       url,
		IsRawText: isRawText,
	}, nil
}
