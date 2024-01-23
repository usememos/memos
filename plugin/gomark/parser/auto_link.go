package parser

import (
	"net/url"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type AutoLinkParser struct{}

func NewAutoLinkParser() *AutoLinkParser {
	return &AutoLinkParser{}
}

func (*AutoLinkParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	if len(tokens) < 3 {
		return nil, 0
	}

	matchedTokens := tokenizer.GetFirstLine(tokens)
	urlStr, isRawText := "", true
	if matchedTokens[0].Type == tokenizer.LessThan {
		greaterThanIndex := tokenizer.FindUnescaped(matchedTokens, tokenizer.GreaterThan)
		if greaterThanIndex < 0 {
			return nil, 0
		}
		matchedTokens = matchedTokens[:greaterThanIndex+1]
		urlStr = tokenizer.Stringify(matchedTokens[1 : len(matchedTokens)-1])
		isRawText = false
	} else {
		u, err := url.Parse(tokenizer.Stringify(matchedTokens))
		if err != nil || u.Scheme == "" || u.Host == "" {
			return nil, 0
		}
		urlStr = tokenizer.Stringify(matchedTokens)
	}

	return &ast.AutoLink{
		URL:       urlStr,
		IsRawText: isRawText,
	}, len(matchedTokens)
}
