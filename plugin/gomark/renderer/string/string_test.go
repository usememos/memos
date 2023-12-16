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
			text:     "",
			expected: "",
		},
		{
			text:     "Hello world!",
			expected: "Hello world!\n",
		},
		{
			text:     "**Hello** world!",
			expected: "Hello world!\n",
		},
		{
			text:     "**[your/slash](https://example.com)** world!",
			expected: "your/slash world!\n",
		},
		{
			text:     "Test\n1. Hello\n2. World",
			expected: "Test\n1. Hello\n2. World\n",
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		nodes, err := parser.Parse(tokens)
		require.NoError(t, err)
		actual := NewStringRenderer().Render(nodes)
		require.Equal(t, test.expected, actual)
	}
}
