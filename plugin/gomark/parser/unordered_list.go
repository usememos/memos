package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type UnorderedListParser struct{}

func NewUnorderedListParser() *UnorderedListParser {
	return &UnorderedListParser{}
}

func (*UnorderedListParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedTokens := tokenizer.GetFirstLine(tokens)
	indent := 0
	for _, token := range matchedTokens {
		if token.Type == tokenizer.Space {
			indent++
		} else {
			break
		}
	}
	if len(matchedTokens) < indent+2 {
		return nil, 0
	}

	symbolToken := matchedTokens[indent]
	if (symbolToken.Type != tokenizer.Hyphen && symbolToken.Type != tokenizer.Asterisk && symbolToken.Type != tokenizer.PlusSign) || matchedTokens[indent+1].Type != tokenizer.Space {
		return nil, 0
	}

	contentTokens := matchedTokens[indent+2:]
	if len(contentTokens) == 0 {
		return nil, 0
	}
	children, err := ParseInline(contentTokens)
	if err != nil {
		return nil, 0
	}
	return &ast.UnorderedList{
		Symbol:   symbolToken.Type,
		Indent:   indent,
		Children: children,
	}, indent + len(contentTokens) + 2
}
