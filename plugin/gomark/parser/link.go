package parser

import "github.com/usememos/memos/plugin/gomark/parser/tokenizer"

type LinkParser struct {
	ContentTokens []*tokenizer.Token
	URL           string
}

func NewLinkParser() *LinkParser {
	return &LinkParser{}
}

func (*LinkParser) Match(tokens []*tokenizer.Token) *LinkParser {
	if len(tokens) < 4 {
		return nil
	}
	if tokens[0].Type != tokenizer.LeftSquareBracket {
		return nil
	}
	cursor, contentTokens := 1, []*tokenizer.Token{}
	for ; cursor < len(tokens)-2; cursor++ {
		if tokens[cursor].Type == tokenizer.Newline {
			return nil
		}
		if tokens[cursor].Type == tokenizer.RightSquareBracket {
			break
		}
		contentTokens = append(contentTokens, tokens[cursor])
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
	if len(contentTokens) == 0 {
		contentTokens = append(contentTokens, &tokenizer.Token{
			Type:  tokenizer.Text,
			Value: url,
		})
	}
	return &LinkParser{
		ContentTokens: contentTokens,
		URL:           url,
	}
}
