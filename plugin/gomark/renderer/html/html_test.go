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
			text:     "# Hello world!",
			expected: `<h1>Hello world!</h1>`,
		},
		{
			text:     "> Hello\n> world!",
			expected: `<blockquote><p>Hello</p><p>world!</p></blockquote>`,
		},
		{
			text:     "*Hello* world!",
			expected: `<p><em>Hello</em> world!</p>`,
		},
		{
			text:     "Hello world!\n\nNew paragraph.",
			expected: "<p>Hello world!</p><br><p>New paragraph.</p>",
		},
		{
			text:     "**Hello** world!",
			expected: `<p><strong>Hello</strong> world!</p>`,
		},
		{
			text:     "#article #memo",
			expected: `<p><span>#article</span> <span>#memo</span></p>`,
		},
		{
			text:     "#article \\#memo",
			expected: `<p><span>#article</span> \#memo</p>`,
		},
		{
			text:     "* Hello\n* world!",
			expected: `<ul><li>Hello</li><li>world!</li></ul>`,
		},
		{
			text:     "1. Hello\n2. world\n* !",
			expected: `<ol><li>Hello</li><li>world</li></ol><ul><li>!</li></ul>`,
		},
		{
			text:     "- [ ] hello\n- [x] world",
			expected: `<ul><li><input type="checkbox" disabled>hello</li><li><input type="checkbox" checked disabled>world</li></ul>`,
		},
		{
			text:     "1. ordered\n* unorder\n- [ ] checkbox\n- [x] checked",
			expected: `<ol><li>ordered</li></ol><ul><li>unorder</li></ul><ul><li><input type="checkbox" disabled>checkbox</li><li><input type="checkbox" checked disabled>checked</li></ul>`,
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		nodes, err := parser.Parse(tokens)
		require.NoError(t, err)
		actual := NewHTMLRenderer().Render(nodes)
		require.Equal(t, test.expected, actual)
	}
}
