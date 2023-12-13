package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestImageParser(t *testing.T) {
	tests := []struct {
		text  string
		image ast.Node
	}{
		{
			text: "![](https://example.com)",
			image: &ast.Image{
				AltText: "",
				URL:     "https://example.com",
			},
		},
		{
			text:  "! [](https://example.com)",
			image: nil,
		},
		{
			text:  "![alte]( htt ps :/ /example.com)",
			image: nil,
		},
		{
			text: "![al te](https://example.com)",
			image: &ast.Image{
				AltText: "al te",
				URL:     "https://example.com",
			},
		},
	}
	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewImageParser().Parse(tokens)
		require.Equal(t, StringifyNodes([]ast.Node{test.image}), StringifyNodes([]ast.Node{node}))
	}
}
