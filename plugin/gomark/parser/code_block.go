package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type CodeBlockParser struct {
	Language string
	Content  string
}

func NewCodeBlockParser() *CodeBlockParser {
	return &CodeBlockParser{}
}

func (*CodeBlockParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 9 {
		return 0, false
	}

	if tokens[0].Type != tokenizer.Backtick || tokens[1].Type != tokenizer.Backtick || tokens[2].Type != tokenizer.Backtick {
		return 0, false
	}
	if tokens[3].Type != tokenizer.Newline && tokens[4].Type != tokenizer.Newline {
		return 0, false
	}
	cursor := 4
	if tokens[3].Type != tokenizer.Newline {
		cursor = 5
	}

	matched := false
	for ; cursor < len(tokens)-3; cursor++ {
		if tokens[cursor].Type == tokenizer.Newline && tokens[cursor+1].Type == tokenizer.Backtick && tokens[cursor+2].Type == tokenizer.Backtick && tokens[cursor+3].Type == tokenizer.Backtick {
			if cursor+3 == len(tokens)-1 {
				cursor += 4
				matched = true
				break
			} else if tokens[cursor+4].Type == tokenizer.Newline {
				cursor += 4
				matched = true
				break
			}
		}
	}
	if !matched {
		return 0, false
	}

	return cursor, true
}

func (p *CodeBlockParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	languageToken := tokens[3]
	contentStart, contentEnd := 5, size-4
	if languageToken.Type == tokenizer.Newline {
		languageToken = nil
		contentStart = 4
	}

	codeBlock := &ast.CodeBlock{
		Content: tokenizer.Stringify(tokens[contentStart:contentEnd]),
	}
	if languageToken != nil {
		codeBlock.Language = languageToken.String()
	}
	return codeBlock, nil
}
