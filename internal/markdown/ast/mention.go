package ast

import (
	gast "github.com/yuin/goldmark/ast"
)

// MentionNode represents an @mention in the markdown AST.
type MentionNode struct {
	gast.BaseInline

	// Username without the @ prefix.
	Username []byte
}

// KindMention is the NodeKind for MentionNode.
var KindMention = gast.NewNodeKind("Mention")

// Kind returns KindMention.
func (*MentionNode) Kind() gast.NodeKind {
	return KindMention
}

// Dump implements Node.Dump for debugging.
func (n *MentionNode) Dump(source []byte, level int) {
	gast.DumpHelper(n, source, level, map[string]string{
		"Username": string(n.Username),
	}, nil)
}
