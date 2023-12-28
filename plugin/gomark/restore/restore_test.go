package restore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
)

func TestRestore(t *testing.T) {
	tests := []struct {
		nodes   []ast.Node
		rawText string
	}{
		{
			nodes:   nil,
			rawText: "",
		},
		{
			nodes: []ast.Node{
				&ast.Text{
					Content: "Hello world!",
				},
			},
			rawText: "Hello world!",
		},
		{
			nodes: []ast.Node{
				&ast.Paragraph{
					Children: []ast.Node{
						&ast.Text{
							Content: "Here: ",
						},
						&ast.Code{
							Content: "Hello world!",
						},
					},
				},
			},
			rawText: "Here: `Hello world!`",
		},
	}

	for _, test := range tests {
		require.Equal(t, Restore(test.nodes), test.rawText)
	}
}
