package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
	"github.com/usememos/memos/plugin/gomark/restore"
)

func TestReferencedContentParser(t *testing.T) {
	tests := []struct {
		text              string
		referencedContent ast.Node
	}{
		{
			text:              "[[Hello world]",
			referencedContent: nil,
		},
		{
			text: "[[Hello world]]",
			referencedContent: &ast.ReferencedContent{
				ResourceName: "Hello world",
			},
		},
		{
			text: "[[memos/1]]",
			referencedContent: &ast.ReferencedContent{
				ResourceName: "memos/1",
			},
		},
		{
			text: "[[resources/101]]111\n123",
			referencedContent: &ast.ReferencedContent{
				ResourceName: "resources/101",
			},
		},
		{
			text: "[[resources/101?align=center]]",
			referencedContent: &ast.ReferencedContent{
				ResourceName: "resources/101",
				Params:       "align=center",
			},
		},
		{
			text: "[[resources/6uxnhT98q8vN8anBbUbRGu?align=center]]",
			referencedContent: &ast.ReferencedContent{
				ResourceName: "resources/6uxnhT98q8vN8anBbUbRGu",
				Params:       "align=center",
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewReferencedContentParser().Match(tokens)
		require.Equal(t, restore.Restore([]ast.Node{test.referencedContent}), restore.Restore([]ast.Node{node}))
	}
}
