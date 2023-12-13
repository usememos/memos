package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type HeadingParser struct{}

func NewHeadingParser() *HeadingParser {
	return &HeadingParser{}
}

func (*HeadingParser) Match(tokens []*tokenizer.Token) (int, bool) {
	cursor := 0
	for _, token := range tokens {
		if token.Type == tokenizer.Hash {
			cursor++
		} else {
			break
		}
	}
	if len(tokens) <= cursor+1 {
		return 0, false
	}
	if tokens[cursor].Type != tokenizer.Space {
		return 0, false
	}
	level := cursor
	if level == 0 || level > 6 {
		return 0, false
	}

	cursor++
	contentTokens := []*tokenizer.Token{}
	for _, token := range tokens[cursor:] {
		if token.Type == tokenizer.Newline {
			break
		}
		contentTokens = append(contentTokens, token)
		cursor++
	}
	if len(contentTokens) == 0 {
		return 0, false
	}

	return cursor, true
}

func (p *HeadingParser) Parse(tokens []*tokenizer.Token) ast.Node {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil
	}

	level := 0
	for _, token := range tokens {
		if token.Type == tokenizer.Hash {
			level++
		} else {
			break
		}
	}
	contentTokens := tokens[level+1 : size]
	children := ParseInline(contentTokens, []InlineParser{
		NewBoldParser(),
		NewCodeParser(),
		NewTextParser(),
	})
	return &ast.Heading{
		Level:    level,
		Children: children,
	}
}
