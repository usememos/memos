package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
	"github.com/usememos/memos/plugin/gomark/restore"
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
					&ast.Paragraph{
						Children: []ast.Node{
							&ast.Text{
								Content: "Hello world",
							},
						},
					},
				},
			},
		},
		{
			text: "> 你好",
			blockquote: &ast.Blockquote{
				Children: []ast.Node{
					&ast.Paragraph{
						Children: []ast.Node{
							&ast.Text{
								Content: "你好",
							},
						},
					},
				},
			},
		},
		{
			text: "> Hello\nworld",
			blockquote: &ast.Blockquote{
				Children: []ast.Node{
					&ast.Paragraph{
						Children: []ast.Node{
							&ast.Text{
								Content: "Hello",
							},
						},
					},
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
		require.Equal(t, restore.Restore([]ast.Node{test.blockquote}), restore.Restore([]ast.Node{node}))
	}
}
