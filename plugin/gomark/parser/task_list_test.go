package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestTaskListParser(t *testing.T) {
	tests := []struct {
		text string
		node ast.Node
	}{
		{
			text: "*asd",
			node: nil,
		},
		{
			text: "+ [ ] Hello World",
			node: &ast.TaskList{
				Symbol:   tokenizer.PlusSign,
				Complete: false,
				Children: []ast.Node{
					&ast.Text{
						Content: "Hello World",
					},
				},
			},
		},
		{
			text: "* [x] **Hello**",
			node: &ast.TaskList{
				Symbol:   tokenizer.Asterisk,
				Complete: true,
				Children: []ast.Node{
					&ast.Bold{
						Symbol: "*",
						Children: []ast.Node{
							&ast.Text{
								Content: "Hello",
							},
						},
					},
				},
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewTaskListParser().Parse(tokens)
		require.Equal(t, StringifyNodes([]ast.Node{test.node}), StringifyNodes([]ast.Node{node}))
	}
}
