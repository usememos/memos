package parser

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

func TestBoldParser(t *testing.T) {
	tests := []struct {
		text string
		bold *BoldParser
	}{
		{
			text: "*Hello world!",
			bold: nil,
		},
		{
			text: "**Hello**",
			bold: &BoldParser{
				ContentTokens: []*tokenizer.Token{
					{
						Type:  tokenizer.Text,
						Value: "Hello",
					},
				},
			},
		},
		{
			text: "** Hello **",
			bold: &BoldParser{
				ContentTokens: []*tokenizer.Token{
					{
						Type:  tokenizer.Space,
						Value: " ",
					},
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
			text: "** Hello * *",
			bold: nil,
		},
		{
			text: "* * Hello **",
			bold: nil,
		},
		{
			text: `** Hello 
**`,
			bold: nil,
		},
		{
			text: `**Hello \n**`,
			bold: &BoldParser{
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
				},
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		bold := NewBoldParser()
		require.Equal(t, test.bold, bold.Match(tokens))
	}
}
