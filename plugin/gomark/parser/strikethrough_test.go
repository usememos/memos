package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestStrikethroughParser(t *testing.T) {
	tests := []struct {
		text          string
		strikethrough ast.Node
	}{
		{
			text:          "~~Hello world",
			strikethrough: nil,
		},
		{
			text: "~~Hello~~",
			strikethrough: &ast.Strikethrough{
				Content: "Hello",
			},
		},
		{
			text: "~~ Hello ~~",
			strikethrough: &ast.Strikethrough{
				Content: " Hello ",
			},
		},
		{
			text: "~~1~~ Hello ~~~",
			strikethrough: &ast.Strikethrough{
				Content: "1",
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewStrikethroughParser().Parse(tokens)
		require.Equal(t, StringifyNodes([]ast.Node{test.strikethrough}), StringifyNodes([]ast.Node{node}))
	}
}
