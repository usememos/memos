package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
	"github.com/usememos/memos/plugin/gomark/restore"
)

func TestSubscriptParser(t *testing.T) {
	tests := []struct {
		text      string
		subscript ast.Node
	}{
		{
			text:      "~Hello world!",
			subscript: nil,
		},
		{
			text: "~Hello~",
			subscript: &ast.Subscript{
				Content: "Hello",
			},
		},
		{
			text: "~ Hello ~",
			subscript: &ast.Subscript{
				Content: " Hello ",
			},
		},
		{
			text: "~1~ Hello ~ ~",
			subscript: &ast.Subscript{
				Content: "1",
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewSubscriptParser().Parse(tokens)
		require.Equal(t, restore.Restore([]ast.Node{test.subscript}), restore.Restore([]ast.Node{node}))
	}
}
