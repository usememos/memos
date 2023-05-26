package parser

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestLinkParser(t *testing.T) {
	tests := []struct {
		text string
		link *LinkParser
	}{
		{
			text: "[](https://example.com)",
			link: &LinkParser{
				ContentTokens: []*tokenizer.Token{
					{
						Type:  tokenizer.Text,
						Value: "https://example.com",
					},
				},
				URL: "https://example.com",
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
			link: &LinkParser{
				ContentTokens: []*tokenizer.Token{
					{
						Type:  tokenizer.Text,
						Value: "hello",
					},
					{
						Type:  tokenizer.Space,
						Value: " ",
					},
					{
						Type:  tokenizer.Text,
						Value: "world",
					},
				},
				URL: "https://example.com",
			},
		},
	}
	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		require.Equal(t, test.link, NewLinkParser().Match(tokens))
	}
}
