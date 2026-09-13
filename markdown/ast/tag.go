package ast

import (
	gast "github.com/yuin/goldmark/ast"
)

// TagNode represents a #tag in the markdown AST.
type TagNode struct {
	gast.BaseInline

	// Tag is the emitted tag value without the # prefix.
	Tag []byte
	// Source is the complete recognized source span, including the # prefix.
	Source []byte
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
		"Tag":    string(n.Tag),
		"Source": string(n.Source),
	}, nil)
}
