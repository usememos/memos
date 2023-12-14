package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestHorizontalRuleParser(t *testing.T) {
	tests := []struct {
		text           string
		horizontalRule ast.Node
	}{
		{
			text: "---",
			horizontalRule: &ast.HorizontalRule{
				Symbol: "-",
			},
		},
		{
			text: "---\naaa",
			horizontalRule: &ast.HorizontalRule{
				Symbol: "-",
			},
		},
		{
			text:           "****",
			horizontalRule: nil,
		},
		{
			text: "***",
			horizontalRule: &ast.HorizontalRule{
				Symbol: "*",
			},
		},
		{
			text:           "-*-",
			horizontalRule: nil,
		},
		{
			text: "___",
			horizontalRule: &ast.HorizontalRule{
				Symbol: "_",
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewHorizontalRuleParser().Parse(tokens)
		require.Equal(t, StringifyNodes([]ast.Node{test.horizontalRule}), StringifyNodes([]ast.Node{node}))
	}
}
