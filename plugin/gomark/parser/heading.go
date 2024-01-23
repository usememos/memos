package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type HeadingParser struct{}

func NewHeadingParser() *HeadingParser {
	return &HeadingParser{}
}

func (*HeadingParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedTokens := tokenizer.GetFirstLine(tokens)
	spaceIndex := tokenizer.FindUnescaped(matchedTokens, tokenizer.Space)
	if spaceIndex < 0 {
		return nil, 0
	}

	for _, token := range matchedTokens[:spaceIndex] {
		if token.Type != tokenizer.PoundSign {
			return nil, 0
		}
	}
	level := spaceIndex
	if level == 0 || level > 6 {
		return nil, 0
	}

	contentTokens := matchedTokens[level+1:]
	if len(contentTokens) == 0 {
		return nil, 0
	}
	children, err := ParseInline(contentTokens)
	if err != nil {
		return nil, 0
	}

	return &ast.Heading{
		Level:    level,
		Children: children,
	}, len(contentTokens) + level + 1
}
