package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
	"github.com/usememos/memos/plugin/gomark/restore"
)

func TestMathParser(t *testing.T) {
	tests := []struct {
		text string
		link ast.Node
	}{
		{
			text: "$\\sqrt{3x-1}+(1+x)^2$",
			link: &ast.Math{
				Content: "\\sqrt{3x-1}+(1+x)^2",
			},
		},
	}
	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewMathParser().Parse(tokens)
		require.Equal(t, restore.Restore([]ast.Node{test.link}), restore.Restore([]ast.Node{node}))
	}
}
