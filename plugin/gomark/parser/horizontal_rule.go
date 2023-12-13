package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type HorizontalRuleParser struct{}

func NewHorizontalRuleParser() *HorizontalRuleParser {
	return &HorizontalRuleParser{}
}

func (*HorizontalRuleParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 3 {
		return 0, false
	}
	if tokens[0].Type != tokens[1].Type || tokens[0].Type != tokens[2].Type || tokens[1].Type != tokens[2].Type {
		return 0, false
	}
	if tokens[0].Type != tokenizer.Dash && tokens[0].Type != tokenizer.Underline && tokens[0].Type != tokenizer.Asterisk {
		return 0, false
	}
	if len(tokens) > 3 && tokens[3].Type != tokenizer.Newline {
		return 0, false
	}
	return 3, true
}

func (p *HorizontalRuleParser) Parse(tokens []*tokenizer.Token) ast.Node {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil
	}

	return &ast.HorizontalRule{
		Symbol: tokens[0].Type,
	}
}
