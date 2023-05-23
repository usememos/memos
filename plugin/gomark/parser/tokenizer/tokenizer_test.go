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
					Type:  Star,
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
					Value: "world!",
				},
			},
		},
		{
			text: `# hello 
 world`,
			tokens: []*Token{
				{
					Type:  Hash,
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
