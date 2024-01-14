package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type TaskListParser struct{}

func NewTaskListParser() *TaskListParser {
	return &TaskListParser{}
}

func (*TaskListParser) Match(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) < 7 {
		return 0, false
	}

	indent := 0
	for _, token := range tokens {
		if token.Type == tokenizer.Space {
			indent++
		} else {
			break
		}
	}
	symbolToken := tokens[indent]
	if symbolToken.Type != tokenizer.Hyphen && symbolToken.Type != tokenizer.Asterisk && symbolToken.Type != tokenizer.PlusSign {
		return 0, false
	}
	if tokens[indent+1].Type != tokenizer.Space {
		return 0, false
	}
	if tokens[indent+2].Type != tokenizer.LeftSquareBracket || (tokens[indent+3].Type != tokenizer.Space && tokens[indent+3].Value != "x") || tokens[indent+4].Type != tokenizer.RightSquareBracket {
		return 0, false
	}
	if tokens[indent+5].Type != tokenizer.Space {
		return 0, false
	}

	contentTokens := []*tokenizer.Token{}
	for _, token := range tokens[indent+6:] {
		if token.Type == tokenizer.Newline {
			break
		}
		contentTokens = append(contentTokens, token)
	}
	if len(contentTokens) == 0 {
		return 0, false
	}

	return indent + len(contentTokens) + 6, true
}

func (p *TaskListParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	indent := 0
	for _, token := range tokens {
		if token.Type == tokenizer.Space {
			indent++
		} else {
			break
		}
	}
	symbolToken := tokens[indent]
	contentTokens := tokens[indent+6 : size]
	children, err := ParseInline(contentTokens)
	if err != nil {
		return nil, err
	}
	return &ast.TaskList{
		Symbol:   symbolToken.Type,
		Indent:   indent,
		Complete: tokens[indent+3].Value == "x",
		Children: children,
	}, nil
}
