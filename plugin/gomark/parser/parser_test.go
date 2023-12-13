package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestParser(t *testing.T) {
	tests := []struct {
		text  string
		nodes []ast.Node
	}{
		{
			text: "Hello world!",
			nodes: []ast.Node{
				&ast.Paragraph{
					Children: []ast.Node{
						&ast.Text{
							Content: "Hello world!",
						},
					},
				},
			},
		},
		{
			text: "**Hello** world!",
			nodes: []ast.Node{
				&ast.Paragraph{
					Children: []ast.Node{
						&ast.Bold{
							Symbol:  "*",
							Content: "Hello",
						},
						&ast.Text{
							Content: " world!",
						},
					},
				},
			},
		},
		{
			text: "Hello **world**!\nHere is a new line.",
			nodes: []ast.Node{
				&ast.Paragraph{
					Children: []ast.Node{
						&ast.Text{
							Content: "Hello ",
						},
						&ast.Bold{
							Symbol:  "*",
							Content: "world",
						},
						&ast.Text{
							Content: "!",
						},
						&ast.LineBreak{},
					},
				},
				&ast.Paragraph{
					Children: []ast.Node{
						&ast.Text{
							Content: "Here is a new line.",
						},
					},
				},
			},
		},
		{
			text: "Hello **world**!\n```javascript\nconsole.log(\"Hello world!\");\n```",
			nodes: []ast.Node{
				&ast.Paragraph{
					Children: []ast.Node{
						&ast.Text{
							Content: "Hello ",
						},
						&ast.Bold{
							Symbol:  "*",
							Content: "world",
						},
						&ast.Text{
							Content: "!",
						},
						&ast.LineBreak{},
					},
				},
				&ast.CodeBlock{
					Language: "javascript",
					Content:  "console.log(\"Hello world!\");",
				},
			},
		},
		{
			text: "Hello world!\n\nNew paragraph.",
			nodes: []ast.Node{
				&ast.Paragraph{
					Children: []ast.Node{
						&ast.Text{
							Content: "Hello world!",
						},
						&ast.LineBreak{},
					},
				},
				&ast.LineBreak{},
				&ast.Paragraph{
					Children: []ast.Node{
						&ast.Text{
							Content: "New paragraph.",
						},
					},
				},
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		nodes, _ := Parse(tokens)
		require.Equal(t, StringifyNodes(test.nodes), StringifyNodes(nodes))
	}
}

func StringifyNodes(nodes []ast.Node) string {
	var result string
	for _, node := range nodes {
		if node != nil {
			result += node.String()
		}
	}
	return result
}
