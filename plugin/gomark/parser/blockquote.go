package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type BlockquoteParser struct{}

func NewBlockquoteParser() *BlockquoteParser {
	return &BlockquoteParser{}
}

func (*BlockquoteParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	rows := tokenizer.Split(tokens, tokenizer.NewLine)
	contentRows := [][]*tokenizer.Token{}
	for _, row := range rows {
		if len(row) < 3 || row[0].Type != tokenizer.GreaterThan || row[1].Type != tokenizer.Space {
			break
		}
		contentRows = append(contentRows, row)
	}
	if len(contentRows) == 0 {
		return nil, 0
	}

	children := []ast.Node{}
	size := 0
	for index, row := range contentRows {
		contentTokens := row[2:]
		nodes, err := ParseBlockWithParsers(contentTokens, []BlockParser{NewBlockquoteParser(), NewParagraphParser()})
		if err != nil {
			return nil, 0
		}
		if len(nodes) != 1 {
			return nil, 0
		}

		children = append(children, nodes[0])
		size += len(row)
		if index != len(contentRows)-1 {
			size += 1 // NewLine.
		}
	}

	return &ast.Blockquote{
		Children: children,
	}, size
}
