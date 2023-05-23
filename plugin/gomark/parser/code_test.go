package parser

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestCodeParser(t *testing.T) {
	tests := []struct {
		text string
		code *CodeParser
	}{
		{
			text: "`Hello world!",
			code: nil,
		},
		{
			text: "`Hello world!`",
			code: &CodeParser{
				Content: "Hello world!",
			},
		},
		{
			text: "`Hello \nworld!`",
			code: nil,
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		code := NewCodeParser()
		require.Equal(t, test.code, code.Match(tokens))
	}
}
