package parser

import (
	"slices"

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

func (*CodeBlockParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	rows := tokenizer.Split(tokens, tokenizer.Newline)
	if len(rows) < 3 {
		return nil, 0
	}

	firstRow := rows[0]
	if len(firstRow) < 3 {
		return nil, 0
	}
	if firstRow[0].Type != tokenizer.Backtick || firstRow[1].Type != tokenizer.Backtick || firstRow[2].Type != tokenizer.Backtick {
		return nil, 0
	}
	languageTokens := []*tokenizer.Token{}
	if len(firstRow) > 3 {
		languageTokens = firstRow[3:]
		// Check if language is valid.
		availableLanguageTokenTypes := []tokenizer.TokenType{tokenizer.Text, tokenizer.Number, tokenizer.Underscore}
		for _, token := range languageTokens {
			if !slices.Contains(availableLanguageTokenTypes, token.Type) {
				return nil, 0
			}
		}
	}

	contentRows := [][]*tokenizer.Token{}
	matched := false
	for _, row := range rows[1:] {
		if len(row) == 3 && row[0].Type == tokenizer.Backtick && row[1].Type == tokenizer.Backtick && row[2].Type == tokenizer.Backtick {
			matched = true
			break
		}
		contentRows = append(contentRows, row)
	}
	if !matched {
		return nil, 0
	}

	contentTokens := []*tokenizer.Token{}
	for index, row := range contentRows {
		contentTokens = append(contentTokens, row...)
		if index != len(contentRows)-1 {
			contentTokens = append(contentTokens, &tokenizer.Token{
				Type:  tokenizer.Newline,
				Value: "\n",
			})
		}
	}

	return &ast.CodeBlock{
		Content:  tokenizer.Stringify(contentTokens),
		Language: tokenizer.Stringify(languageTokens),
	}, 4 + len(languageTokens) + len(contentTokens) + 4
}
