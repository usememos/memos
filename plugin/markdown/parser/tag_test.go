package parser

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"

	mast "github.com/usememos/memos/plugin/markdown/ast"
)

func TestTagParser(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectedTag string
		shouldParse bool
	}{
		{
			name:        "basic tag",
			input:       "#tag",
			expectedTag: "tag",
			shouldParse: true,
		},
		{
			name:        "tag with hyphen",
			input:       "#work-notes",
			expectedTag: "work-notes",
			shouldParse: true,
		},
		{
			name:        "tag with underscore",
			input:       "#2024_plans",
			expectedTag: "2024_plans",
			shouldParse: true,
		},
		{
			name:        "numeric tag",
			input:       "#123",
			expectedTag: "123",
			shouldParse: true,
		},
		{
			name:        "tag followed by space",
			input:       "#tag ",
			expectedTag: "tag",
			shouldParse: true,
		},
		{
			name:        "tag followed by punctuation",
			input:       "#tag.",
			expectedTag: "tag",
			shouldParse: true,
		},
		{
			name:        "tag in sentence",
			input:       "#important task",
			expectedTag: "important",
			shouldParse: true,
		},
		{
			name:        "heading (##)",
			input:       "## Heading",
			expectedTag: "",
			shouldParse: false,
		},
		{
			name:        "space after hash",
			input:       "# heading",
			expectedTag: "",
			shouldParse: false,
		},
		{
			name:        "lone hash",
			input:       "#",
			expectedTag: "",
			shouldParse: false,
		},
		{
			name:        "hash with space",
			input:       "# ",
			expectedTag: "",
			shouldParse: false,
		},
		{
			name:        "special characters",
			input:       "#tag@special",
			expectedTag: "tag",
			shouldParse: true,
		},
		{
			name:        "mixed case",
			input:       "#WorkNotes",
			expectedTag: "WorkNotes",
			shouldParse: true,
		},
		{
			name:        "hierarchical tag with slash",
			input:       "#tag1/subtag",
			expectedTag: "tag1/subtag",
			shouldParse: true,
		},
		{
			name:        "hierarchical tag with multiple levels",
			input:       "#tag1/subtag/subtag2",
			expectedTag: "tag1/subtag/subtag2",
			shouldParse: true,
		},
		{
			name:        "hierarchical tag followed by space",
			input:       "#work/notes ",
			expectedTag: "work/notes",
			shouldParse: true,
		},
		{
			name:        "hierarchical tag followed by punctuation",
			input:       "#project/2024.",
			expectedTag: "project/2024",
			shouldParse: true,
		},
		{
			name:        "hierarchical tag with numbers and dashes",
			input:       "#work-log/2024/q1",
			expectedTag: "work-log/2024/q1",
			shouldParse: true,
		},
		{
			name:        "Chinese characters",
			input:       "#测试",
			expectedTag: "测试",
			shouldParse: true,
		},
		{
			name:        "Chinese tag followed by space",
			input:       "#测试 some text",
			expectedTag: "测试",
			shouldParse: true,
		},
		{
			name:        "Chinese tag followed by punctuation",
			input:       "#测试。",
			expectedTag: "测试",
			shouldParse: true,
		},
		{
			name:        "mixed Chinese and ASCII",
			input:       "#测试test123",
			expectedTag: "测试test123",
			shouldParse: true,
		},
		{
			name:        "Japanese characters",
			input:       "#テスト",
			expectedTag: "テスト",
			shouldParse: true,
		},
		{
			name:        "Korean characters",
			input:       "#테스트",
			expectedTag: "테스트",
			shouldParse: true,
		},
		{
			name:        "emoji",
			input:       "#test🚀",
			expectedTag: "test🚀",
			shouldParse: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewTagParser()
			reader := text.NewReader([]byte(tt.input))
			ctx := parser.NewContext()

			node := p.Parse(nil, reader, ctx)

			if tt.shouldParse {
				require.NotNil(t, node, "Expected tag to be parsed")
				require.IsType(t, &mast.TagNode{}, node)

				tagNode, ok := node.(*mast.TagNode)
				require.True(t, ok, "Expected node to be *mast.TagNode")
				assert.Equal(t, tt.expectedTag, string(tagNode.Tag))
			} else {
				assert.Nil(t, node, "Expected tag NOT to be parsed")
			}
		})
	}
}

func TestTagParser_Trigger(t *testing.T) {
	p := NewTagParser()
	triggers := p.Trigger()

	assert.Equal(t, []byte{'#'}, triggers)
}

func TestTagParser_MultipleTags(t *testing.T) {
	// Test that parser correctly handles multiple tags in sequence
	input := "#tag1 #tag2"

	p := NewTagParser()
	reader := text.NewReader([]byte(input))
	ctx := parser.NewContext()

	// Parse first tag
	node1 := p.Parse(nil, reader, ctx)
	require.NotNil(t, node1)
	tagNode1, ok := node1.(*mast.TagNode)
	require.True(t, ok, "Expected node1 to be *mast.TagNode")
	assert.Equal(t, "tag1", string(tagNode1.Tag))

	// Advance past the space
	reader.Advance(1)

	// Parse second tag
	node2 := p.Parse(nil, reader, ctx)
	require.NotNil(t, node2)
	tagNode2, ok := node2.(*mast.TagNode)
	require.True(t, ok, "Expected node2 to be *mast.TagNode")
	assert.Equal(t, "tag2", string(tagNode2.Tag))
}

func TestTagNode_Kind(t *testing.T) {
	node := &mast.TagNode{
		Tag: []byte("test"),
	}

	assert.Equal(t, mast.KindTag, node.Kind())
}

func TestTagNode_Dump(t *testing.T) {
	node := &mast.TagNode{
		Tag: []byte("test"),
	}

	// Should not panic
	assert.NotPanics(t, func() {
		node.Dump([]byte("#test"), 0)
	})
}
