package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
	"github.com/usememos/memos/plugin/gomark/restore"
)

func TestSuperscriptParser(t *testing.T) {
	tests := []struct {
		text        string
		superscript ast.Node
	}{
		{
			text:        "^Hello world!",
			superscript: nil,
		},
		{
			text: "^Hello^",
			superscript: &ast.Superscript{
				Content: "Hello",
			},
		},
		{
			text: "^ Hello ^",
			superscript: &ast.Superscript{
				Content: " Hello ",
			},
		},
		{
			text: "^1^ Hello ^ ^",
			superscript: &ast.Superscript{
				Content: "1",
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewSuperscriptParser().Parse(tokens)
		require.Equal(t, restore.Restore([]ast.Node{test.superscript}), restore.Restore([]ast.Node{node}))
	}
}
