package parser

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestHeadingParser(t *testing.T) {
	tests := []struct {
		text    string
		heading *HeadingTokenizer
	}{
		{
			text:    "*Hello world!",
			heading: nil,
		},
		{
			text: "## Hello World!",
			heading: &HeadingTokenizer{
				Level: 2,
				ContentTokens: []*tokenizer.Token{
					{
						Type:  tokenizer.Text,
						Value: "Hello",
					},
					{
						Type:  tokenizer.Space,
						Value: " ",
					},
					{
						Type:  tokenizer.Text,
						Value: "World!",
					},
				},
			},
		},
		{
			text: "# # Hello World",
			heading: &HeadingTokenizer{
				Level: 1,
				ContentTokens: []*tokenizer.Token{
					{
						Type:  tokenizer.Hash,
						Value: "#",
					},
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
					{
						Type:  tokenizer.Text,
						Value: "World",
					},
				},
			},
		},
		{
			text:    " # 123123 Hello World!",
			heading: nil,
		},
		{
			text: `# 123 
Hello World!`,
			heading: &HeadingTokenizer{
				Level: 1,
				ContentTokens: []*tokenizer.Token{
					{
						Type:  tokenizer.Text,
						Value: "123",
					},
					{
						Type:  tokenizer.Space,
						Value: " ",
					},
				},
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		headingTokenizer := NewHeadingTokenizer()
		require.Equal(t, test.heading, headingTokenizer.Match(tokens))
	}
}
