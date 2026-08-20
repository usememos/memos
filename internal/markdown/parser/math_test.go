package parser

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/yuin/goldmark"
	gast "github.com/yuin/goldmark/ast"
	gparser "github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
	"github.com/yuin/goldmark/util"

	mast "github.com/usememos/memos/internal/markdown/ast"
)

func TestInlineMathParserDollarBoundaries(t *testing.T) {
	tests := []struct {
		name     string
		source   string
		expected []string
	}{
		{name: "valid single dollar math", source: "$x$", expected: []string{"$x$"}},
		{name: "currency stays literal", source: "$20,000 and $30,000"},
		{
			name: "multiline currency list stays literal",
			source: `list of 10 houses
$140,000 max - buffer of ~10k
diy, add amount to down payment
no appliances covered
less than $1,000, client responsibilities
over $1,000 - owner responsibility
vacant is good to rent
for sale by owner
path to ownership -$50
rent insurance - my of`,
		},
		{name: "opening followed by whitespace", source: "$ x$"},
		{name: "opening followed by tab", source: "$\tx$"},
		{name: "opening followed by line ending", source: "$\nx$"},
		{name: "opening followed by Unicode whitespace", source: "$\u00a0x$"},
		{name: "opening followed by next line character", source: "$\u0085x$"},
		{name: "closing preceded by whitespace", source: "$x $"},
		{name: "closing preceded by tab", source: "$x\t$"},
		{name: "closing followed by digit", source: "$x$2"},
		{name: "retry after closer preceded by whitespace", source: "$x $ and $y$", expected: []string{"$y$"}},
		{name: "retry after closer followed by digit", source: "$x$2 and $y$", expected: []string{"$y$"}},
		{name: "retry after currency dollars", source: "$20 and $30 then $x$", expected: []string{"$x$"}},
		{name: "closing followed by Unicode digit", source: "$x$٢", expected: []string{"$x$"}},
		{name: "valid multiline math", source: "$x +\ny$", expected: []string{"$x +\ny$"}},
		{name: "multiline closing at line start", source: "$x\n$"},
		{name: "exact closing run", source: "$x$$ y$", expected: []string{"$x$$ y$"}},
		{name: "opener after escaped dollar", source: `\$$x$`, expected: []string{"$x$"}},
		{name: "multi-dollar boundaries unchanged", source: "$$ x $$2", expected: []string{"$$ x $$"}},
	}

	md := goldmark.New(
		goldmark.WithParserOptions(
			gparser.WithInlineParsers(
				util.Prioritized(NewInlineMathParser(), 150),
			),
		),
	)
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			document := md.Parser().Parse(text.NewReader([]byte(test.source)))
			var actual []string
			err := gast.Walk(document, func(node gast.Node, entering bool) (gast.WalkStatus, error) {
				if entering {
					if mathNode, ok := node.(*mast.InlineMathNode); ok {
						actual = append(actual, string(mathNode.Source))
					}
				}
				return gast.WalkContinue, nil
			})
			require.NoError(t, err)
			assert.Equal(t, test.expected, actual)
		})
	}
}
