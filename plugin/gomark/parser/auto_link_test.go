package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestAutoLinkParser(t *testing.T) {
	tests := []struct {
		text string
		link ast.Node
	}{
		{
			text: "<https://example.com)",
			link: nil,
		},
		{
			text: "<https://example.com>",
			link: &ast.AutoLink{
				URL: "https://example.com",
			},
		},
		{
			text: "https://example.com",
			link: &ast.AutoLink{
				URL: "https://example.com",
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewAutoLinkParser().Parse(tokens)
		require.Equal(t, StringifyNodes([]ast.Node{test.link}), StringifyNodes([]ast.Node{node}))
	}
}
