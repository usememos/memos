package parser

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"

	mast "github.com/usememos/memos/plugin/markdown/ast"
)

func TestWikilinkParser(t *testing.T) {
	tests := []struct {
		name           string
		input          string
		expectedTarget string
		expectedParams string
		shouldParse    bool
	}{
		{
			name:           "basic wikilink",
			input:          "[[Hello world]]",
			expectedTarget: "Hello world",
			expectedParams: "",
			shouldParse:    true,
		},
		{
			name:           "memo wikilink",
			input:          "[[memos/1]]",
			expectedTarget: "memos/1",
			expectedParams: "",
			shouldParse:    true,
		},
		{
			name:           "resource wikilink",
			input:          "[[resources/101]]",
			expectedTarget: "resources/101",
			expectedParams: "",
			shouldParse:    true,
		},
		{
			name:           "with parameters",
			input:          "[[resources/101?align=center]]",
			expectedTarget: "resources/101",
			expectedParams: "align=center",
			shouldParse:    true,
		},
		{
			name:           "multiple parameters",
			input:          "[[resources/101?align=center&width=300]]",
			expectedTarget: "resources/101",
			expectedParams: "align=center&width=300",
			shouldParse:    true,
		},
		{
			name:           "inline with text after",
			input:          "[[resources/101]]111",
			expectedTarget: "resources/101",
			expectedParams: "",
			shouldParse:    true,
		},
		{
			name:           "whitespace trimmed",
			input:          "[[  Hello world  ]]",
			expectedTarget: "Hello world",
			expectedParams: "",
			shouldParse:    true,
		},
		{
			name:           "empty content",
			input:          "[[]]",
			expectedTarget: "",
			expectedParams: "",
			shouldParse:    false,
		},
		{
			name:           "whitespace only",
			input:          "[[   ]]",
			expectedTarget: "",
			expectedParams: "",
			shouldParse:    false,
		},
		{
			name:           "missing closing brackets",
			input:          "[[Hello world",
			expectedTarget: "",
			expectedParams: "",
			shouldParse:    false,
		},
		{
			name:           "single bracket",
			input:          "[Hello]",
			expectedTarget: "",
			expectedParams: "",
			shouldParse:    false,
		},
		{
			name:           "nested brackets",
			input:          "[[outer [[inner]] ]]",
			expectedTarget: "outer [[inner",
			expectedParams: "",
			shouldParse:    true, // Stops at first ]]
		},
		{
			name:           "special characters",
			input:          "[[Project/2024/Notes]]",
			expectedTarget: "Project/2024/Notes",
			expectedParams: "",
			shouldParse:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewWikilinkParser()
			reader := text.NewReader([]byte(tt.input))
			ctx := parser.NewContext()

			node := p.Parse(nil, reader, ctx)

			if tt.shouldParse {
				require.NotNil(t, node, "Expected wikilink to be parsed")
				require.IsType(t, &mast.WikilinkNode{}, node)

				wikilinkNode, ok := node.(*mast.WikilinkNode)
				require.True(t, ok, "Expected node to be *mast.WikilinkNode")
				assert.Equal(t, tt.expectedTarget, string(wikilinkNode.Target))
				assert.Equal(t, tt.expectedParams, string(wikilinkNode.Params))
			} else {
				assert.Nil(t, node, "Expected wikilink NOT to be parsed")
			}
		})
	}
}

func TestWikilinkParser_Trigger(t *testing.T) {
	p := NewWikilinkParser()
	triggers := p.Trigger()

	assert.Equal(t, []byte{'['}, triggers)
}

func TestFindClosingBrackets(t *testing.T) {
	tests := []struct {
		name     string
		input    []byte
		expected int
	}{
		{
			name:     "simple case",
			input:    []byte("hello]]world"),
			expected: 5,
		},
		{
			name:     "not found",
			input:    []byte("hello world"),
			expected: -1,
		},
		{
			name:     "at start",
			input:    []byte("]]hello"),
			expected: 0,
		},
		{
			name:     "single bracket",
			input:    []byte("hello]world"),
			expected: -1,
		},
		{
			name:     "empty",
			input:    []byte(""),
			expected: -1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := findClosingBrackets(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestParseTargetAndParams(t *testing.T) {
	tests := []struct {
		name           string
		input          []byte
		expectedTarget string
		expectedParams string
	}{
		{
			name:           "no params",
			input:          []byte("target"),
			expectedTarget: "target",
			expectedParams: "",
		},
		{
			name:           "with params",
			input:          []byte("target?param=value"),
			expectedTarget: "target",
			expectedParams: "param=value",
		},
		{
			name:           "multiple params",
			input:          []byte("target?a=1&b=2"),
			expectedTarget: "target",
			expectedParams: "a=1&b=2",
		},
		{
			name:           "whitespace trimmed from target",
			input:          []byte("  target  ?param=value"),
			expectedTarget: "target",
			expectedParams: "param=value",
		},
		{
			name:           "empty params",
			input:          []byte("target?"),
			expectedTarget: "target",
			expectedParams: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			target, params := parseTargetAndParams(tt.input)
			assert.Equal(t, tt.expectedTarget, string(target))
			assert.Equal(t, tt.expectedParams, string(params))
		})
	}
}

func TestWikilinkNode_Kind(t *testing.T) {
	node := &mast.WikilinkNode{
		Target: []byte("test"),
	}

	assert.Equal(t, mast.KindWikilink, node.Kind())
}

func TestWikilinkNode_Dump(t *testing.T) {
	node := &mast.WikilinkNode{
		Target: []byte("test"),
		Params: []byte("param=value"),
	}

	// Should not panic
	assert.NotPanics(t, func() {
		node.Dump([]byte("[[test?param=value]]"), 0)
	})
}
