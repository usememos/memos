package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestUnorderedListParser(t *testing.T) {
	tests := []struct {
		text string
		node ast.Node
	}{
		{
			text: "*asd",
			node: nil,
		},
		{
			text: "+ Hello World",
			node: &ast.UnorderedList{
				Symbol: tokenizer.PlusSign,
				Children: []ast.Node{
					&ast.Text{
						Content: "Hello World",
					},
				},
			},
		},
		{
			text: "* **Hello**",
			node: &ast.UnorderedList{
				Symbol: tokenizer.Asterisk,
				Children: []ast.Node{
					&ast.Bold{
						Symbol:  "*",
						Content: "Hello",
					},
				},
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewUnorderedListParser().Parse(tokens)
		require.Equal(t, StringifyNodes([]ast.Node{test.node}), StringifyNodes([]ast.Node{node}))
	}
}
