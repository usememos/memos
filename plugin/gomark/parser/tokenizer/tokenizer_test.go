package tokenizer

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTokenize(t *testing.T) {
	tests := []struct {
		text   string
		tokens []*Token
	}{
		{
			text: "*Hello world!",
			tokens: []*Token{
				{
					Type:  Asterisk,
					Value: "*",
				},
				{
					Type:  Text,
					Value: "Hello",
				},
				{
					Type:  Space,
					Value: " ",
				},
				{
					Type:  Text,
					Value: "world",
				},
				{
					Type:  ExclamationMark,
					Value: "!",
				},
			},
		},
		{
			text: `# hello 
 world`,
			tokens: []*Token{
				{
					Type:  PoundSign,
					Value: "#",
				},
				{
					Type:  Space,
					Value: " ",
				},
				{
					Type:  Text,
					Value: "hello",
				},
				{
					Type:  Space,
					Value: " ",
				},
				{
					Type:  Newline,
					Value: "\n",
				},
				{
					Type:  Space,
					Value: " ",
				},
				{
					Type:  Text,
					Value: "world",
				},
			},
		},
	}

	for _, test := range tests {
		result := Tokenize(test.text)
		require.Equal(t, test.tokens, result)
	}
}

func TestSplit(t *testing.T) {
	tests := []struct {
		tokens []*Token
		sep    TokenType
		result [][]*Token
	}{

		{
			tokens: []*Token{
				{
					Type:  Asterisk,
					Value: "*",
				},
				{
					Type:  Text,
					Value: "Hello",
				},
				{
					Type:  Space,
					Value: " ",
				},
				{
					Type:  Text,
					Value: "world",
				},
				{
					Type:  ExclamationMark,
					Value: "!",
				},
			},
			sep: Asterisk,
			result: [][]*Token{
				{},
				{
					{
						Type:  Text,
						Value: "Hello",
					},
					{
						Type:  Space,
						Value: " ",
					},
					{
						Type:  Text,
						Value: "world",
					},
					{
						Type:  ExclamationMark,
						Value: "!",
					},
				},
			},
		},
	}

	for _, test := range tests {
		result := Split(test.tokens, test.sep)
		for index, tokens := range result {
			require.Equal(t, Stringify(test.result[index]), Stringify(tokens))
		}
	}
}
