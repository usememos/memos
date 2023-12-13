package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestItalicParser(t *testing.T) {
	tests := []struct {
		text   string
		italic ast.Node
	}{
		{
			text:   "*Hello world!",
			italic: nil,
		},
		{
			text: "*Hello*",
			italic: &ast.Italic{
				Symbol:  "*",
				Content: "Hello",
			},
		},
		{
			text: "* Hello *",
			italic: &ast.Italic{
				Symbol:  "*",
				Content: " Hello ",
			},
		},
		{
			text: "*1* Hello * *",
			italic: &ast.Italic{
				Symbol:  "*",
				Content: "1",
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewItalicParser().Parse(tokens)
		require.Equal(t, StringifyNodes([]ast.Node{test.italic}), StringifyNodes([]ast.Node{node}))
	}
}
