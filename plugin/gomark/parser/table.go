package parser

import (
	"errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
)

type TableParser struct{}

func NewTableParser() *TableParser {
	return &TableParser{}
}

func (*TableParser) Match(tokens []*tokenizer.Token) (int, bool) {
	headerTokens := []*tokenizer.Token{}
	for _, token := range tokens {
		if token.Type == tokenizer.Newline {
			break
		}
		headerTokens = append(headerTokens, token)
	}
	if len(headerTokens) < 5 || len(tokens) < len(headerTokens)+3 {
		return 0, false
	}

	delimiterTokens := []*tokenizer.Token{}
	for _, token := range tokens[len(headerTokens)+1:] {
		if token.Type == tokenizer.Newline {
			break
		}
		delimiterTokens = append(delimiterTokens, token)
	}
	if len(delimiterTokens) < 5 || len(tokens) < len(headerTokens)+len(delimiterTokens)+3 {
		return 0, false
	}

	rowTokens := []*tokenizer.Token{}
	for index, token := range tokens[len(headerTokens)+len(delimiterTokens)+2:] {
		temp := len(headerTokens) + len(delimiterTokens) + 2 + index
		if token.Type == tokenizer.Newline && temp != len(tokens)-1 && tokens[temp+1].Type != tokenizer.Pipe {
			break
		}
		rowTokens = append(rowTokens, token)
	}
	if len(rowTokens) < 5 {
		return 0, false
	}

	// Check header.
	if len(headerTokens) < 5 {
		return 0, false
	}
	headerCells, ok := matchTableCellTokens(headerTokens)
	if headerCells == 0 || !ok {
		return 0, false
	}

	// Check delimiter.
	if len(delimiterTokens) < 5 {
		return 0, false
	}
	delimiterCells, ok := matchTableCellTokens(delimiterTokens)
	if delimiterCells != headerCells || !ok {
		return 0, false
	}
	for _, t := range tokenizer.Split(delimiterTokens, tokenizer.Pipe) {
		delimiterTokens := t[1 : len(t)-1]
		if len(delimiterTokens) < 3 {
			return 0, false
		}
		if (delimiterTokens[0].Type != tokenizer.Colon && delimiterTokens[0].Type != tokenizer.Hyphen) || (delimiterTokens[len(delimiterTokens)-1].Type != tokenizer.Colon && delimiterTokens[len(delimiterTokens)-1].Type != tokenizer.Hyphen) {
			return 0, false
		}
		for _, token := range delimiterTokens[1 : len(delimiterTokens)-1] {
			if token.Type != tokenizer.Hyphen {
				return 0, false
			}
		}
	}

	// Check rows.
	if len(rowTokens) < 5 {
		return 0, false
	}
	rows := tokenizer.Split(rowTokens, tokenizer.Newline)
	if len(rows) == 0 {
		return 0, false
	}
	for _, row := range rows {
		cells, ok := matchTableCellTokens(row)
		if cells != headerCells || !ok {
			return 0, false
		}
	}

	return len(headerTokens) + len(delimiterTokens) + len(rowTokens) + 2, true
}

func (p *TableParser) Parse(tokens []*tokenizer.Token) (ast.Node, error) {
	size, ok := p.Match(tokens)
	if size == 0 || !ok {
		return nil, errors.New("not matched")
	}

	rawRows := tokenizer.Split(tokens[:size-1], tokenizer.Newline)
	headerTokens := rawRows[0]
	dilimiterTokens := rawRows[1]
	rowTokens := rawRows[2:]
	header := make([]string, 0)
	delimiter := make([]string, 0)
	rows := make([][]string, 0)

	for _, t := range tokenizer.Split(headerTokens, tokenizer.Pipe) {
		header = append(header, tokenizer.Stringify(t[1:len(t)-1]))
	}
	for _, t := range tokenizer.Split(dilimiterTokens, tokenizer.Pipe) {
		delimiter = append(delimiter, tokenizer.Stringify(t[1:len(t)-1]))
	}
	for _, row := range rowTokens {
		cells := make([]string, 0)
		for _, t := range tokenizer.Split(row, tokenizer.Pipe) {
			cells = append(cells, tokenizer.Stringify(t[1:len(t)-1]))
		}
		rows = append(rows, cells)
	}

	return &ast.Table{
		Header:    header,
		Delimiter: delimiter,
		Rows:      rows,
	}, nil
}

func matchTableCellTokens(tokens []*tokenizer.Token) (int, bool) {
	if len(tokens) == 0 {
		return 0, false
	}

	pipes := 0
	for _, token := range tokens {
		if token.Type == tokenizer.Pipe {
			pipes++
		}
	}
	cells := tokenizer.Split(tokens, tokenizer.Pipe)
	if len(cells) != pipes-1 {
		return 0, false
	}
	for _, cellTokens := range cells {
		if len(cellTokens) == 0 {
			return 0, false
		}
		if cellTokens[0].Type != tokenizer.Space {
			return 0, false
		}
		if cellTokens[len(cellTokens)-1].Type != tokenizer.Space {
			return 0, false
		}
	}

	return len(cells), true
}
