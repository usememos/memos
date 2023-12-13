package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestBoldItalicParser(t *testing.T) {
	tests := []struct {
		text       string
		boldItalic ast.Node
	}{
		{
			text:       "*Hello world!",
			boldItalic: nil,
		},
		{
			text: "***Hello***",
			boldItalic: &ast.BoldItalic{
				Symbol:  "*",
				Content: "Hello",
			},
		},
		{
			text: "*** Hello ***",
			boldItalic: &ast.BoldItalic{
				Symbol:  "*",
				Content: " Hello ",
			},
		},
		{
			text:       "*** Hello * *",
			boldItalic: nil,
		},
		{
			text:       "*** Hello **",
			boldItalic: nil,
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		require.Equal(t, test.boldItalic, NewBoldItalicParser().Parse(tokens))
	}
}
