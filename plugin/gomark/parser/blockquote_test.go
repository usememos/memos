package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestBlockquoteParser(t *testing.T) {
	tests := []struct {
		text       string
		blockquote ast.Node
	}{
		{
			text: "> Hello world",
			blockquote: &ast.Blockquote{
				Children: []ast.Node{
					&ast.Text{
						Content: "Hello world",
					},
				},
			},
		},
		{
			text: "> Hello\nworld",
			blockquote: &ast.Blockquote{
				Children: []ast.Node{
					&ast.Text{
						Content: "Hello",
					},
					&ast.LineBreak{},
				},
			},
		},
		{
			text:       ">Hello\nworld",
			blockquote: nil,
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewBlockquoteParser().Parse(tokens)
		require.Equal(t, StringifyNodes([]ast.Node{test.blockquote}), StringifyNodes([]ast.Node{node}))
	}
}
