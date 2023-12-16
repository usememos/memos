package string

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/parser"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestStringRender(t *testing.T) {
	tests := []struct {
		text     string
		expected string
	}{
		{
			text:     "Hello world!",
			expected: `Hello world!`,
		},
		{
			text:     "**Hello** world!",
			expected: `Hello world!`,
		},
		{
			text:     "**[your/slash](https://example.com)** world!",
			expected: `your/slash world!`,
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		nodes, err := parser.Parse(tokens)
		require.NoError(t, err)
		actual := NewStringRender().Render(nodes)
		require.Equal(t, test.expected, actual)
	}
}
