package ast

import (
	gast "github.com/yuin/goldmark/ast"
)

// TagNode represents a #tag in the markdown AST.
type TagNode struct {
	gast.BaseInline

	// Tag name without the # prefix
	Tag []byte
}

// KindTag is the NodeKind for TagNode.
var KindTag = gast.NewNodeKind("Tag")

// Kind returns KindTag.
func (*TagNode) Kind() gast.NodeKind {
	return KindTag
}

// Dump implements Node.Dump for debugging.
func (n *TagNode) Dump(source []byte, level int) {
	gast.DumpHelper(n, source, level, map[string]string{
		"Tag": string(n.Tag),
	}, nil)
}
