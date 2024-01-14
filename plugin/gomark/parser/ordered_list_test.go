package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
	"github.com/usememos/memos/plugin/gomark/restore"
)

func TestOrderedListParser(t *testing.T) {
	tests := []struct {
		text string
		node ast.Node
	}{
		{
			text: "1.asd",
			node: nil,
		},
		{
			text: "1. Hello World",
			node: &ast.OrderedList{
				Number: "1",
				Children: []ast.Node{
					&ast.Text{
						Content: "Hello World",
					},
				},
			},
		},
		{
			text: "  1. Hello World",
			node: &ast.OrderedList{
				Number: "1",
				Indent: 2,
				Children: []ast.Node{
					&ast.Text{
						Content: "Hello World",
					},
				},
			},
		},
		{
			text: "1aa. Hello World",
			node: nil,
		},
		{
			text: "22. Hello *World*",
			node: &ast.OrderedList{
				Number: "22",
				Children: []ast.Node{
					&ast.Text{
						Content: "Hello ",
					},
					&ast.Italic{
						Symbol:  "*",
						Content: "World",
					},
				},
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewOrderedListParser().Parse(tokens)
		require.Equal(t, restore.Restore([]ast.Node{test.node}), restore.Restore([]ast.Node{node}))
	}
}
