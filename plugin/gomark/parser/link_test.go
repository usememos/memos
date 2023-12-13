package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestLinkParser(t *testing.T) {
	tests := []struct {
		text string
		link ast.Node
	}{
		{
			text: "[](https://example.com)",
			link: &ast.Link{
				Text: "",
				URL:  "https://example.com",
			},
		},
		{
			text: "! [](https://example.com)",
			link: nil,
		},
		{
			text: "[alte]( htt ps :/ /example.com)",
			link: nil,
		},
		{
			text: "[hello world](https://example.com)",
			link: &ast.Link{
				Text: "hello world",
				URL:  "https://example.com",
			},
		},
	}
	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		require.Equal(t, test.link, NewLinkParser().Parse(tokens))
	}
}
