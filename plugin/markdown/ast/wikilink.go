package ast

import (
	gast "github.com/yuin/goldmark/ast"
)

// WikilinkNode represents [[target]] or [[target?params]] syntax.
type WikilinkNode struct {
	gast.BaseInline

	// Target is the link destination (e.g., "memos/1", "Hello world", "resources/101")
	Target []byte

	// Params are optional parameters (e.g., "align=center" from [[target?align=center]])
	Params []byte
}

// KindWikilink is the NodeKind for WikilinkNode.
var KindWikilink = gast.NewNodeKind("Wikilink")

// Kind returns KindWikilink.
func (*WikilinkNode) Kind() gast.NodeKind {
	return KindWikilink
}

// Dump implements Node.Dump for debugging.
func (n *WikilinkNode) Dump(source []byte, level int) {
	gast.DumpHelper(n, source, level, map[string]string{
		"Target": string(n.Target),
		"Params": string(n.Params),
	}, nil)
}
