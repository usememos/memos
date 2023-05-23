package parser

import "github.com/usememos/memos/plugin/gomark/parser/tokenizer"

type CodeParser struct {
	Content string
}

func NewCodeParser() *CodeParser {
	return &CodeParser{}
}

func (*CodeParser) Match(tokens []*tokenizer.Token) *CodeParser {
	if len(tokens) < 3 {
		return nil
	}
	if tokens[0].Type != tokenizer.Backtick {
		return nil
	}

	content, matched := "", false
	for _, token := range tokens[1:] {
		if token.Type == tokenizer.Newline {
			return nil
		}
		if token.Type == tokenizer.Backtick {
			matched = true
			break
		}
		content += token.Value
	}
	if !matched || len(content) == 0 {
		return nil
	}
	return &CodeParser{
		Content: content,
	}
}
