package parser

import "github.com/usememos/memos/plugin/gomark/parser/tokenizer"

type CodeBlockParser struct {
	Language string
	Content  string
}

func NewCodeBlockParser() *CodeBlockParser {
	return &CodeBlockParser{}
}

func (*CodeBlockParser) Match(tokens []*tokenizer.Token) *CodeBlockParser {
	if len(tokens) < 9 {
		return nil
	}

	if tokens[0].Type != tokenizer.Backtick || tokens[1].Type != tokenizer.Backtick || tokens[2].Type != tokenizer.Backtick {
		return nil
	}
	if tokens[3].Type != tokenizer.Newline && tokens[4].Type != tokenizer.Newline {
		return nil
	}
	cursor, language := 4, ""
	if tokens[3].Type != tokenizer.Newline {
		language = tokens[3].Value
		cursor = 5
	}

	content, matched := "", false
	for ; cursor < len(tokens)-3; cursor++ {
		if tokens[cursor].Type == tokenizer.Newline && tokens[cursor+1].Type == tokenizer.Backtick && tokens[cursor+2].Type == tokenizer.Backtick && tokens[cursor+3].Type == tokenizer.Backtick {
			if cursor+3 == len(tokens)-1 {
				matched = true
				break
			} else if tokens[cursor+4].Type == tokenizer.Newline {
				matched = true
				break
			}
		}
		content += tokens[cursor].Value
	}
	if !matched {
		return nil
	}

	return &CodeBlockParser{
		Language: language,
		Content:  content,
	}
}
