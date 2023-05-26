package parser

import "github.com/usememos/memos/plugin/gomark/parser/tokenizer"

type ImageParser struct {
	AltText string
	URL     string
}

func NewImageParser() *ImageParser {
	return &ImageParser{}
}

func (*ImageParser) Match(tokens []*tokenizer.Token) *ImageParser {
	if len(tokens) < 5 {
		return nil
	}
	if tokens[0].Type != tokenizer.ExclamationMark {
		return nil
	}
	if tokens[1].Type != tokenizer.LeftSquareBracket {
		return nil
	}
	cursor, altText := 2, ""
	for ; cursor < len(tokens)-2; cursor++ {
		if tokens[cursor].Type == tokenizer.Newline {
			return nil
		}
		if tokens[cursor].Type == tokenizer.RightSquareBracket {
			break
		}
		altText += tokens[cursor].Value
	}
	if tokens[cursor+1].Type != tokenizer.LeftParenthesis {
		return nil
	}
	matched, url := false, ""
	for _, token := range tokens[cursor+2:] {
		if token.Type == tokenizer.Newline || token.Type == tokenizer.Space {
			return nil
		}
		if token.Type == tokenizer.RightParenthesis {
			matched = true
			break
		}
		url += token.Value
	}
	if !matched || url == "" {
		return nil
	}
	return &ImageParser{
		AltText: altText,
		URL:     url,
	}
}
