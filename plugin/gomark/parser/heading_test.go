package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestHeadingParser(t *testing.T) {
	tests := []struct {
		text    string
		heading ast.Node
	}{
		{
			text:    "*Hello world",
			heading: nil,
		},
		{
			text: "## Hello World",
			heading: &ast.Heading{
				Level: 2,
				Children: []ast.Node{
					&ast.Text{
						Content: "Hello World",
					},
				},
			},
		},
		{
			text: "# # Hello World",
			heading: &ast.Heading{
				Level: 1,
				Children: []ast.Node{
					&ast.Text{
						Content: "# Hello World",
					},
				},
			},
		},
		{
			text:    " # 123123 Hello World",
			heading: nil,
		},
		{
			text: `# 123 
Hello World`,
			heading: &ast.Heading{
				Level: 1,
				Children: []ast.Node{
					&ast.Text{
						Content: "123 ",
					},
					&ast.LineBreak{},
				},
			},
		},
		{
			text: "### **Hello** World",
			heading: &ast.Heading{
				Level: 3,
				Children: []ast.Node{
					&ast.Bold{
						Symbol:  "*",
						Content: "Hello",
					},
					&ast.Text{
						Content: " World",
					},
				},
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewHeadingParser().Parse(tokens)
		require.Equal(t, StringifyNodes([]ast.Node{test.heading}), StringifyNodes([]ast.Node{node}))
	}
}
