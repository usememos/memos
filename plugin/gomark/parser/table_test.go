package parser

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
	"github.com/usememos/memos/plugin/gomark/restore"
)

func TestTableParser(t *testing.T) {
	tests := []struct {
		text  string
		table ast.Node
	}{
		{
			text: "| header |\n| --- |\n| cell |\n",
			table: &ast.Table{
				Header:    []string{"header"},
				Delimiter: []string{"---"},
				Rows: [][]string{
					{"cell"},
				},
			},
		},
		{
			text: "| header1 | header2 |\n| --- | ---- |\n| cell1 | cell2 |\n| cell3 | cell4 |",
			table: &ast.Table{
				Header:    []string{"header1", "header2"},
				Delimiter: []string{"---", "----"},
				Rows: [][]string{
					{"cell1", "cell2"},
					{"cell3", "cell4"},
				},
			},
		},
		{
			text: "| header1 | header2 |\n| :-- | ----: |\n| cell1 | cell2 |\n| cell3 | cell4 |",
			table: &ast.Table{
				Header:    []string{"header1", "header2"},
				Delimiter: []string{":--", "----:"},
				Rows: [][]string{
					{"cell1", "cell2"},
					{"cell3", "cell4"},
				},
			},
		},
	}

	for _, test := range tests {
		tokens := tokenizer.Tokenize(test.text)
		node, _ := NewTableParser().Parse(tokens)
		require.Equal(t, restore.Restore([]ast.Node{test.table}), restore.Restore([]ast.Node{node}))
	}
}
