package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
	"github.com/usememos/memos/plugin/gomark/restore"
)

func TestMathBlockParser(t *testing.T) {
	tests := []struct {
		text string
		link ast.Node
	}{
		{
			text: "$$\n(1+x)^2\n$$",
			link: &ast.MathBlock{
				Content: "(1+x)^2",
			},
		},
		{
			text: "$$\na=3\n$$",
			link: &ast.MathBlock{
				Content: "a=3",
			},
		},
	}
	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewMathBlockParser().Parse(tokens)
		require.Equal(t, restore.Restore([]ast.Node{test.link}), restore.Restore([]ast.Node{node}))
	}
}
