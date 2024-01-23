package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type ReferencedContentParser struct{}

func NewReferencedContentParser() *ReferencedContentParser {
	return &ReferencedContentParser{}
}

func (*ReferencedContentParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedTokens := tokenizer.GetFirstLine(tokens)
	if len(matchedTokens) < 5 {
		return nil, 0
	}
	if matchedTokens[0].Type != tokenizer.LeftSquareBracket || matchedTokens[1].Type != tokenizer.LeftSquareBracket {
		return nil, 0
	}

	contentTokens := []*tokenizer.Token{}
	matched := false
	for index, token := range matchedTokens[2 : len(matchedTokens)-1] {
		if token.Type == tokenizer.RightSquareBracket && matchedTokens[2+index+1].Type == tokenizer.RightSquareBracket {
			matched = true
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if !matched {
		return nil, 0
	}

	resourceName, params := tokenizer.Stringify(contentTokens), ""
	questionMarkIndex := tokenizer.FindUnescaped(contentTokens, tokenizer.QuestionMark)
	if questionMarkIndex > 0 {
		resourceName, params = tokenizer.Stringify(contentTokens[:questionMarkIndex]), tokenizer.Stringify(contentTokens[questionMarkIndex+1:])
	}
	return &ast.ReferencedContent{
		ResourceName: resourceName,
		Params:       params,
	}, len(contentTokens) + 4
}
