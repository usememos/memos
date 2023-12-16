package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestEscapingCharacterParser(t *testing.T) {
	tests := []struct {
		text string
		node ast.Node
	}{
		{
			text: `\# 123`,
			node: &ast.EscapingCharacter{
				Symbol: "#",
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewEscapingCharacterParser().Parse(tokens)
		require.Equal(t, StringifyNodes([]ast.Node{test.node}), StringifyNodes([]ast.Node{node}))
	}
}
