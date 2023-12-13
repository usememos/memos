package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestTagParser(t *testing.T) {
	tests := []struct {
		text string
		tag  ast.Node
	}{
		{
			text: "*Hello world",
			tag:  nil,
		},
		{
			text: "# Hello World",
			tag:  nil,
		},
		{
			text: "#tag",
			tag: &ast.Tag{
				Content: "tag",
			},
		},
		{
			text: "#tag/subtag 123",
			tag: &ast.Tag{
				Content: "tag/subtag",
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewTagParser().Parse(tokens)
		require.Equal(t, StringifyNodes([]ast.Node{test.tag}), StringifyNodes([]ast.Node{node}))
	}
}
