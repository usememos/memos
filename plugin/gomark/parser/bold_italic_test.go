package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestBoldItalicParser(t *testing.T) {
	tests := []struct {
		text       string
		boldItalic ast.Node
	}{
		{
			text:       "*Hello world!",
			boldItalic: nil,
		},
		{
			text: "***Hello***",
			boldItalic: &ast.BoldItalic{
				Symbol:  "*",
				Content: "Hello",
			},
		},
		{
			text: "*** Hello ***",
			boldItalic: &ast.BoldItalic{
				Symbol:  "*",
				Content: " Hello ",
			},
		},
		{
			text:       "*** Hello * *",
			boldItalic: nil,
		},
		{
			text:       "*** Hello **",
			boldItalic: nil,
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewBoldItalicParser().Parse(tokens)
		require.Equal(t, StringifyNodes([]ast.Node{test.boldItalic}), StringifyNodes([]ast.Node{node}))
	}
}
