package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
	"github.com/usememos/memos/plugin/gomark/restore"
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
			text: "# Hello world!",
			nodes: []ast.Node{
				&ast.Heading{
					Level: 1,
					Children: []ast.Node{
						&ast.Text{
							Content: "Hello world!",
						},
					},
				},
			},
		},
		{
			text: "\\# Hello world!",
			nodes: []ast.Node{
				&ast.Paragraph{
					Children: []ast.Node{
						&ast.EscapingCharacter{
							Symbol: "#",
						},
						&ast.Text{
							Content: " Hello world!",
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
							Symbol: "*",
							Children: []ast.Node{
								&ast.Text{
									Content: "Hello",
								},
							},
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
							Symbol: "*",
							Children: []ast.Node{
								&ast.Text{
									Content: "world",
								},
							},
						},
						&ast.Text{
							Content: "!",
						},
					},
				},
				&ast.LineBreak{},
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
							Symbol: "*",
							Children: []ast.Node{
								&ast.Text{
									Content: "world",
								},
							},
						},
						&ast.Text{
							Content: "!",
						},
					},
				},
				&ast.LineBreak{},
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
					},
				},
				&ast.LineBreak{},
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
		{
			text: "1. hello\n- [ ] world",
			nodes: []ast.Node{
				&ast.OrderedList{
					Number: "1",
					Children: []ast.Node{
						&ast.Text{
							Content: "hello",
						},
					},
				},
				&ast.LineBreak{},
				&ast.TaskList{
					Symbol:   tokenizer.Hyphen,
					Complete: false,
					Children: []ast.Node{
						&ast.Text{
							Content: "world",
						},
					},
				},
			},
		},
		{
			text: "- [ ] hello\n- [x] world",
			nodes: []ast.Node{
				&ast.TaskList{
					Symbol:   tokenizer.Hyphen,
					Complete: false,
					Children: []ast.Node{
						&ast.Text{
							Content: "hello",
						},
					},
				},
				&ast.LineBreak{},
				&ast.TaskList{
					Symbol:   tokenizer.Hyphen,
					Complete: true,
					Children: []ast.Node{
						&ast.Text{
							Content: "world",
						},
					},
				},
			},
		},
		{
			text: "\n\n",
			nodes: []ast.Node{
				&ast.LineBreak{},
				&ast.LineBreak{},
			},
		},
		{
			text: "\n$$\na=3\n$$",
			nodes: []ast.Node{
				&ast.LineBreak{},
				&ast.MathBlock{
					Content: "a=3",
				},
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		nodes, _ := Parse(tokens)
		require.Equal(t, restore.Restore(test.nodes), restore.Restore(nodes))
	}
}
