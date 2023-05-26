package parser

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestParagraphParser(t *testing.T) {
	tests := []struct {
		text      string
		paragraph *ParagraphParser
	}{
		{
			text:      "",
			paragraph: nil,
		},
		{
			text: "Hello world",
			paragraph: &ParagraphParser{
				ContentTokens: []*tokenizer.Token{
					{
						Type:  tokenizer.Text,
						Value: "Hello",
					},
					{
						Type:  tokenizer.Space,
						Value: " ",
					},
					{
						Type:  tokenizer.Text,
						Value: "world",
					},
				},
			},
		},
		{
			text: `Hello 
world`,
			paragraph: &ParagraphParser{
				ContentTokens: []*tokenizer.Token{
					{
						Type:  tokenizer.Text,
						Value: "Hello",
					},
					{
						Type:  tokenizer.Space,
						Value: " ",
					},
				},
			},
		},
		{
			text: `Hello \n 
world`,
			paragraph: &ParagraphParser{
				ContentTokens: []*tokenizer.Token{
					{
						Type:  tokenizer.Text,
						Value: "Hello",
					},
					{
						Type:  tokenizer.Space,
						Value: " ",
					},
					{
						Type:  tokenizer.Text,
						Value: `\n`,
					},
					{
						Type:  tokenizer.Space,
						Value: " ",
					},
				},
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		paragraph := NewParagraphParser()
		require.Equal(t, test.paragraph, paragraph.Match(tokens))
	}
}
