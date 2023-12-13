package html

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/parser"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestHTMLRenderer(t *testing.T) {
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
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		nodes, err := parser.Parse(tokens)
		require.NoError(t, err)
		actual := NewHTMLRenderer().Render(nodes)
		if actual != test.expected {
			t.Errorf("expected: %s, actual: %s", test.expected, actual)
		}
	}
}
