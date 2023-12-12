package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestParagraphParser(t *testing.T) {
	tests := []struct {
		text      string
		paragraph ast.Node
	}{
		{
			text:      "",
			paragraph: nil,
		},
		{
			text: "Hello world!",
			paragraph: &ast.Paragraph{
				Children: []ast.Node{
					&ast.Text{
						Content: "Hello world!",
					},
				},
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		parser := NewParagraphParser()
		require.Equal(t, test.paragraph, parser.Parse(tokens))
	}
}
