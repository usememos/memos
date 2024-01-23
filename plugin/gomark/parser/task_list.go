package parser

import (
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type TaskListParser struct{}

func NewTaskListParser() *TaskListParser {
	return &TaskListParser{}
}

func (*TaskListParser) Match(tokens []*tokenizer.Token) (ast.Node, int) {
	matchedTokens := tokenizer.GetFirstLine(tokens)
	indent := 0
	for _, token := range matchedTokens {
		if token.Type == tokenizer.Space {
			indent++
		} else {
			break
		}
	}
	if len(matchedTokens) < indent+6 {
		return nil, 0
	}

	symbolToken := matchedTokens[indent]
	if symbolToken.Type != tokenizer.Hyphen && symbolToken.Type != tokenizer.Asterisk && symbolToken.Type != tokenizer.PlusSign {
		return nil, 0
	}
	if matchedTokens[indent+1].Type != tokenizer.Space {
		return nil, 0
	}
	if matchedTokens[indent+2].Type != tokenizer.LeftSquareBracket || (matchedTokens[indent+3].Type != tokenizer.Space && matchedTokens[indent+3].Value != "x") || matchedTokens[indent+4].Type != tokenizer.RightSquareBracket {
		return nil, 0
	}
	if matchedTokens[indent+5].Type != tokenizer.Space {
		return nil, 0
	}

	contentTokens := matchedTokens[indent+6:]
	if len(contentTokens) == 0 {
		return nil, 0
	}

	children, err := ParseInline(contentTokens)
	if err != nil {
		return nil, 0
	}
	return &ast.TaskList{
		Symbol:   symbolToken.Type,
		Indent:   indent,
		Complete: matchedTokens[indent+3].Value == "x",
		Children: children,
	}, indent + len(contentTokens) + 6
}
