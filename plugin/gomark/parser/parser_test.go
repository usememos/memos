package parser

import (
	"strconv"
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
			result += StringifyNode(node)
		}
	}
	return result
}

func StringifyNode(node ast.Node) string {
	switch n := node.(type) {
	case *ast.LineBreak:
		return "LineBreak()"
	case *ast.CodeBlock:
		return "CodeBlock(" + n.Language + ", " + n.Content + ")"
	case *ast.Paragraph:
		return "Paragraph(" + StringifyNodes(n.Children) + ")"
	case *ast.Heading:
		return "Heading(" + StringifyNodes(n.Children) + ")"
	case *ast.HorizontalRule:
		return "HorizontalRule(" + n.Symbol + ")"
	case *ast.Blockquote:
		return "Blockquote(" + StringifyNodes(n.Children) + ")"
	case *ast.OrderedList:
		return "OrderedList(" + n.Number + ", " + StringifyNodes(n.Children) + ")"
	case *ast.UnorderedList:
		return "UnorderedList(" + n.Symbol + ", " + StringifyNodes(n.Children) + ")"
	case *ast.TaskList:
		return "TaskList(" + n.Symbol + ", " + strconv.FormatBool(n.Complete) + ", " + StringifyNodes(n.Children) + ")"
	case *ast.Text:
		return "Text(" + n.Content + ")"
	case *ast.Bold:
		return "Bold(" + n.Symbol + StringifyNodes(n.Children) + n.Symbol + ")"
	case *ast.Italic:
		return "Italic(" + n.Symbol + n.Content + n.Symbol + ")"
	case *ast.BoldItalic:
		return "BoldItalic(" + n.Symbol + n.Content + n.Symbol + ")"
	case *ast.Code:
		return "Code(" + n.Content + ")"
	case *ast.Image:
		return "Image(" + n.URL + ", " + n.AltText + ")"
	case *ast.Link:
		return "Link(" + n.Text + ", " + n.URL + ")"
	case *ast.Tag:
		return "Tag(" + n.Content + ")"
	case *ast.Strikethrough:
		return "Strikethrough(" + n.Content + ")"
	case *ast.EscapingCharacter:
		return "EscapingCharacter(" + n.Symbol + ")"
	}
	return ""
}
