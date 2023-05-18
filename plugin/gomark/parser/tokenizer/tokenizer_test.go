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
	}
	for _, test := range tests {
		result := tokenize(test.text)
		require.Equal(t, test.tokens, result)
	}
}
