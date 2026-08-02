package ast

import gast "github.com/yuin/goldmark/ast"

// GFMEmailNode represents a written extended GFM email autolink.
type GFMEmailNode struct {
	gast.BaseInline

	// Source is the exact Markdown source spelling.
	Source []byte
	// Address is the decoded email address used by the rendered link.
	Address []byte
}

// KindGFMEmail is the NodeKind for GFMEmailNode.
var KindGFMEmail = gast.NewNodeKind("GFMEmail")

// Kind returns KindGFMEmail.
func (*GFMEmailNode) Kind() gast.NodeKind {
	return KindGFMEmail
}

// Dump implements Node.Dump for debugging.
func (n *GFMEmailNode) Dump(source []byte, level int) {
	gast.DumpHelper(n, source, level, map[string]string{
		"Address": string(n.Address),
		"Source":  string(n.Source),
	}, nil)
}
