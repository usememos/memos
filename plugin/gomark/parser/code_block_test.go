package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
	"github.com/usememos/memos/plugin/gomark/restore"
)

func TestCodeBlockParser(t *testing.T) {
	tests := []struct {
		text      string
		codeBlock ast.Node
	}{
		{
			text:      "```Hello world!```",
			codeBlock: nil,
		},
		{
			text: "```\nHello\n```",
			codeBlock: &ast.CodeBlock{
				Language: "",
				Content:  "Hello",
			},
		},
		{
			text: "```\nHello world!\n```",
			codeBlock: &ast.CodeBlock{
				Language: "",
				Content:  "Hello world!",
			},
		},
		{
			text: "```java\nHello \n world!\n```",
			codeBlock: &ast.CodeBlock{
				Language: "java",
				Content:  "Hello \n world!",
			},
		},
		{
			text:      "```java\nHello \n world!\n```111",
			codeBlock: nil,
		},
		{
			text:      "```java\nHello \n world!\n``` 111",
			codeBlock: nil,
		},
		{
			text: "```java\nHello \n world!\n```\n123123",
			codeBlock: &ast.CodeBlock{
				Language: "java",
				Content:  "Hello \n world!",
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewCodeBlockParser().Parse(tokens)
		require.Equal(t, restore.Restore([]ast.Node{test.codeBlock}), restore.Restore([]ast.Node{node}))
	}
}
