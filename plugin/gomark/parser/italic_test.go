package parser

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestItalicParser(t *testing.T) {
	tests := []struct {
		text   string
		italic *ItalicParser
	}{
		{
			text:   "*Hello world!",
			italic: nil,
		},
		{
			text: "*Hello*",
			italic: &ItalicParser{
				ContentTokens: []*tokenizer.Token{
					{
						Type:  tokenizer.Text,
						Value: "Hello",
					},
				},
			},
		},
		{
			text: "* Hello *",
			italic: &ItalicParser{
				ContentTokens: []*tokenizer.Token{
					{
						Type:  tokenizer.Space,
						Value: " ",
					},
					{
						Type:  tokenizer.Text,
						Value: "Hello",
					},
					{
						Type:  tokenizer.Space,
						Value: " ",
					},
				},
			},
		},
		{
			text:   "** Hello * *",
			italic: nil,
		},
		{
			text: "*1* Hello * *",
			italic: &ItalicParser{
				ContentTokens: []*tokenizer.Token{
					{
						Type:  tokenizer.Text,
						Value: "1",
					},
				},
			},
		},
		{
			text: `* \n * Hello * *`,
			italic: &ItalicParser{
				ContentTokens: []*tokenizer.Token{
					{
						Type:  tokenizer.Space,
						Value: " ",
					},
					{
						Type:  tokenizer.Text,
						Value: `\n`,
					},
					{
						Type:  tokenizer.Space,
						Value: " ",
					},
				},
			},
		},
		{
			text:   "* \n * Hello * *",
			italic: nil,
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		italic := NewItalicParser()
		require.Equal(t, test.italic, italic.Match(tokens))
	}
}
