package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type EmbeddedContentParser struct{}

func NewEmbeddedContentParser() *EmbeddedContentParser {
	return &EmbeddedContentParser{}
}

func (*EmbeddedContentParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedTokens := tokenizer.GetFirstLine(tokens)
	if len(matchedTokens) < 6 {
		return nil, 0
	}
	if matchedTokens[0].Type != tokenizer.ExclamationMark || matchedTokens[1].Type != tokenizer.LeftSquareBracket || matchedTokens[2].Type != tokenizer.LeftSquareBracket {
		return nil, 0
	}
	matched := false
	for index, token := range matchedTokens[:len(matchedTokens)-1] {
		if token.Type == tokenizer.RightSquareBracket && matchedTokens[index+1].Type == tokenizer.RightSquareBracket && index+1 == len(matchedTokens)-1 {
			matched = true
			break
		}
	}
	if !matched {
		return nil, 0
	}

	contentTokens := matchedTokens[3 : len(matchedTokens)-2]
	resourceName, params := tokenizer.Stringify(contentTokens), ""
	questionMarkIndex := tokenizer.FindUnescaped(contentTokens, tokenizer.QuestionMark)
	if questionMarkIndex > 0 {
		resourceName, params = tokenizer.Stringify(contentTokens[:questionMarkIndex]), tokenizer.Stringify(contentTokens[questionMarkIndex+1:])
	}
	return &ast.EmbeddedContent{
		ResourceName: resourceName,
		Params:       params,
	}, len(matchedTokens)
}
