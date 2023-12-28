package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
	"github.com/usememos/memos/plugin/gomark/restore"
)

func TestCodeParser(t *testing.T) {
	tests := []struct {
		text string
		code ast.Node
	}{
		{
			text: "`Hello world!",
			code: nil,
		},
		{
			text: "`Hello world!`",
			code: &ast.Code{
				Content: "Hello world!",
			},
		},
		{
			text: "`Hello \nworld!`",
			code: nil,
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewCodeParser().Parse(tokens)
		require.Equal(t, restore.Restore([]ast.Node{test.code}), restore.Restore([]ast.Node{node}))
	}
}
