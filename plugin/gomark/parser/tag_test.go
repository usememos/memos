package parser

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestTagParser(t *testing.T) {
	tests := []struct {
		text string
		tag  *TagParser
	}{
		{
			text: "*Hello world",
			tag:  nil,
		},
		{
			text: "# Hello World",
			tag:  nil,
		},
		{
			text: "#tag",
			tag: &TagParser{
				ContentTokens: []*tokenizer.Token{
					{
						Type:  tokenizer.Text,
						Value: "tag",
					},
				},
			},
		},
		{
			text: "#tag/subtag",
			tag: &TagParser{
				ContentTokens: []*tokenizer.Token{
					{
						Type:  tokenizer.Text,
						Value: "tag/subtag",
					},
				},
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		require.Equal(t, test.tag, NewTagParser().Match(tokens))
	}
}
