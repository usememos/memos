package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
	"github.com/usememos/memos/plugin/gomark/restore"
)

func TestEmbeddedContentParser(t *testing.T) {
	tests := []struct {
		text            string
		embeddedContent ast.Node
	}{
		{
			text:            "![[Hello world]",
			embeddedContent: nil,
		},
		{
			text: "![[Hello world]]",
			embeddedContent: &ast.EmbeddedContent{
				ResourceName: "Hello world",
			},
		},
		{
			text: "![[memos/1]]",
			embeddedContent: &ast.EmbeddedContent{
				ResourceName: "memos/1",
			},
		},
		{
			text:            "![[resources/101]] \n123",
			embeddedContent: nil,
		},
		{
			text: "![[resources/101]]\n123",
			embeddedContent: &ast.EmbeddedContent{
				ResourceName: "resources/101",
			},
		},
		{
			text: "![[resources/101?align=center]]\n123",
			embeddedContent: &ast.EmbeddedContent{
				ResourceName: "resources/101",
				Params:       "align=center",
			},
		},
		{
			text: "![[resources/6uxnhT98q8vN8anBbUbRGu?align=center]]",
			embeddedContent: &ast.EmbeddedContent{
				ResourceName: "resources/6uxnhT98q8vN8anBbUbRGu",
				Params:       "align=center",
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewEmbeddedContentParser().Match(tokens)
		require.Equal(t, restore.Restore([]ast.Node{test.embeddedContent}), restore.Restore([]ast.Node{node}))
	}
}
