package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type OrderedListParser struct{}

func NewOrderedListParser() *OrderedListParser {
	return &OrderedListParser{}
}

func (*OrderedListParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedTokens := tokenizer.GetFirstLine(tokens)
	indent := 0
	for _, token := range matchedTokens {
		if token.Type == tokenizer.Space {
			indent++
		} else {
			break
		}
	}
	if len(matchedTokens) < indent+3 {
		return nil, 0
	}

	corsor := indent
	if matchedTokens[corsor].Type != tokenizer.Number || matchedTokens[corsor+1].Type != tokenizer.Dot || matchedTokens[corsor+2].Type != tokenizer.Space {
		return nil, 0
	}

	contentTokens := matchedTokens[corsor+3:]
	if len(contentTokens) == 0 {
		return nil, 0
	}

	children, err := ParseInline(contentTokens)
	if err != nil {
		return nil, 0
	}
	return &ast.OrderedList{
		Number:   matchedTokens[indent].Value,
		Indent:   indent,
		Children: children,
	}, indent + 3 + len(contentTokens)
}
