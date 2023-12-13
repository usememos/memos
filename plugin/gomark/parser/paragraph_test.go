package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestParagraphParser(t *testing.T) {
	tests := []struct {
		text      string
		paragraph ast.Node
	}{
		{
			text:      "",
			paragraph: nil,
		},
		{
			text:      "\n",
			paragraph: nil,
		},
		{
			text: "Hello world!",
			paragraph: &ast.Paragraph{
				Children: []ast.Node{
					&ast.Text{
						Content: "Hello world!",
					},
				},
			},
		},
		{
			text: "Hello world!\n",
			paragraph: &ast.Paragraph{
				Children: []ast.Node{
					&ast.Text{
						Content: "Hello world!",
					},
					&ast.LineBreak{},
				},
			},
		},
		{
			text: "Hello world!\n\nNew paragraph.",
			paragraph: &ast.Paragraph{
				Children: []ast.Node{
					&ast.Text{
						Content: "Hello world!",
					},
					&ast.LineBreak{},
				},
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewParagraphParser().Parse(tokens)
		require.Equal(t, StringifyNodes([]ast.Node{test.paragraph}), StringifyNodes([]ast.Node{node}))
	}
}
