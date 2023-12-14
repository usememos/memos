package html

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/parser"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestHTMLRender(t *testing.T) {
	tests := []struct {
		text     string
		expected string
	}{
		{
			text:     "Hello world!",
			expected: `<p>Hello world!</p>`,
		},
		{
			text:     "> Hello\n> world!",
			expected: `<blockquote>Hello<br>world!</blockquote>`,
		},
		{
			text:     "*Hello* world!",
			expected: `<p><em>Hello</em> world!</p>`,
		},
		{
			text:     "**Hello** world!",
			expected: `<p><strong>Hello</strong> world!</p>`,
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		nodes, err := parser.Parse(tokens)
		require.NoError(t, err)
		actual := NewHTMLRender().Render(nodes)
		require.Equal(t, test.expected, actual)
	}
}
