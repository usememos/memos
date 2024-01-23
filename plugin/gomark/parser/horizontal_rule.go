package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type HorizontalRuleParser struct{}

func NewHorizontalRuleParser() *HorizontalRuleParser {
	return &HorizontalRuleParser{}
}

func (*HorizontalRuleParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedTokens := tokenizer.GetFirstLine(tokens)
	if len(matchedTokens) < 3 {
		return nil, 0
	}
	if len(matchedTokens) > 3 && matchedTokens[3].Type != tokenizer.Newline {
		return nil, 0
	}
	if matchedTokens[0].Type != matchedTokens[1].Type || matchedTokens[0].Type != matchedTokens[2].Type || matchedTokens[1].Type != matchedTokens[2].Type {
		return nil, 0
	}
	if matchedTokens[0].Type != tokenizer.Hyphen && matchedTokens[0].Type != tokenizer.Underscore && matchedTokens[0].Type != tokenizer.Asterisk {
		return nil, 0
	}
	return &ast.HorizontalRule{
		Symbol: matchedTokens[0].Type,
	}, 3
}
