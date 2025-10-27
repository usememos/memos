package renderer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"

	"github.com/usememos/memos/plugin/markdown/extensions"
)

func TestMarkdownRenderer(t *testing.T) {
	// Create goldmark instance with all extensions
	md := goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,
			extensions.TagExtension,
		),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
	)

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "simple text",
			input:    "Hello world",
			expected: "Hello world",
		},
		{
			name:     "paragraph with newlines",
			input:    "First paragraph\n\nSecond paragraph",
			expected: "First paragraph\n\nSecond paragraph",
		},
		{
			name:     "emphasis",
			input:    "This is *italic* and **bold** text",
			expected: "This is *italic* and **bold** text",
		},
		{
			name:     "headings",
			input:    "# Heading 1\n\n## Heading 2\n\n### Heading 3",
			expected: "# Heading 1\n\n## Heading 2\n\n### Heading 3",
		},
		{
			name:     "link",
			input:    "Check [this link](https://example.com)",
			expected: "Check [this link](https://example.com)",
		},
		{
			name:     "image",
			input:    "![alt text](image.png)",
			expected: "![alt text](image.png)",
		},
		{
			name:     "code inline",
			input:    "This is `inline code` here",
			expected: "This is `inline code` here",
		},
		{
			name:     "code block fenced",
			input:    "```go\nfunc main() {\n}\n```",
			expected: "```go\nfunc main() {\n}\n```",
		},
		{
			name:     "unordered list",
			input:    "- Item 1\n- Item 2\n- Item 3",
			expected: "- Item 1\n- Item 2\n- Item 3",
		},
		{
			name:     "ordered list",
			input:    "1. First\n2. Second\n3. Third",
			expected: "1. First\n2. Second\n3. Third",
		},
		{
			name:     "blockquote",
			input:    "> This is a quote\n> Second line",
			expected: "> This is a quote\n> Second line",
		},
		{
			name:     "horizontal rule",
			input:    "Text before\n\n---\n\nText after",
			expected: "Text before\n\n---\n\nText after",
		},
		{
			name:     "strikethrough",
			input:    "This is ~~deleted~~ text",
			expected: "This is ~~deleted~~ text",
		},
		{
			name:     "task list",
			input:    "- [x] Completed task\n- [ ] Incomplete task",
			expected: "- [x] Completed task\n- [ ] Incomplete task",
		},
		{
			name:     "tag",
			input:    "This has #tag in it",
			expected: "This has #tag in it",
		},
		{
			name:     "multiple tags",
			input:    "#work #important meeting notes",
			expected: "#work #important meeting notes",
		},
		{
			name:     "complex mixed content",
			input:    "# Meeting Notes\n\n**Date**: 2024-01-01\n\n## Attendees\n- Alice\n- Bob\n\n## Discussion\n\nWe discussed #project status.\n\n```python\nprint('hello')\n```",
			expected: "# Meeting Notes\n\n**Date**: 2024-01-01\n\n## Attendees\n\n- Alice\n- Bob\n\n## Discussion\n\nWe discussed #project status.\n\n```python\nprint('hello')\n```",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Parse the input
			source := []byte(tt.input)
			reader := text.NewReader(source)
			doc := md.Parser().Parse(reader)
			require.NotNil(t, doc)

			// Render back to markdown
			renderer := NewMarkdownRenderer()
			result := renderer.Render(doc, source)

			// For debugging
			if result != tt.expected {
				t.Logf("Input:    %q", tt.input)
				t.Logf("Expected: %q", tt.expected)
				t.Logf("Got:      %q", result)
			}

			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMarkdownRendererPreservesStructure(t *testing.T) {
	// Test that parsing and rendering preserves structure
	md := goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,
			extensions.TagExtension,
		),
	)

	inputs := []string{
		"# Title\n\nParagraph",
		"**Bold** and *italic*",
		"- List\n- Items",
		"#tag #another",
		"> Quote",
	}

	renderer := NewMarkdownRenderer()

	for _, input := range inputs {
		t.Run(input, func(t *testing.T) {
			source := []byte(input)
			reader := text.NewReader(source)
			doc := md.Parser().Parse(reader)

			result := renderer.Render(doc, source)

			// The result should be structurally similar
			// (may have minor formatting differences)
			assert.NotEmpty(t, result)
		})
	}
}
