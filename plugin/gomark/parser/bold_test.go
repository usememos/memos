package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestBoldParser(t *testing.T) {
	tests := []struct {
		text string
		bold ast.Node
	}{
		{
			text: "*Hello world!",
			bold: nil,
		},
		{
			text: "**Hello**",
			bold: &ast.Bold{
				Symbol:  "*",
				Content: "Hello",
			},
		},
		{
			text: "** Hello **",
			bold: &ast.Bold{
				Symbol:  "*",
				Content: " Hello ",
			},
		},
		{
			text: "** Hello * *",
			bold: nil,
		},
		{
			text: "* * Hello **",
			bold: nil,
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewBoldParser().Parse(tokens)
		require.Equal(t, StringifyNodes([]ast.Node{test.bold}), StringifyNodes([]ast.Node{node}))
	}
}
