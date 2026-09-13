package ast

import (
	"fmt"

	gast "github.com/yuin/goldmark/ast"
)

// InlineMathNode represents literal inline math, including its dollar delimiters.
type InlineMathNode struct {
	gast.BaseInline

	// Source is the complete logical source spelling.
	Source []byte
}

// KindInlineMath is the NodeKind for InlineMathNode.
var KindInlineMath = gast.NewNodeKind("InlineMath")

// Kind returns KindInlineMath.
func (*InlineMathNode) Kind() gast.NodeKind {
	return KindInlineMath
}

// Dump implements Node.Dump for debugging.
func (n *InlineMathNode) Dump(source []byte, level int) {
	gast.DumpHelper(n, source, level, map[string]string{
		"Source": string(n.Source),
	}, nil)
}

// BlockMathNode represents literal flow math, including its dollar fences.
type BlockMathNode struct {
	gast.BaseBlock

	// Source is the complete logical source spelling.
	Source []byte
	fence  int
}

// KindBlockMath is the NodeKind for BlockMathNode.
var KindBlockMath = gast.NewNodeKind("BlockMath")

// NewBlockMathNode creates a flow math node from its opening line.
func NewBlockMathNode(opening []byte, fence int) *BlockMathNode {
	return &BlockMathNode{
		Source: append([]byte(nil), opening...),
		fence:  fence,
	}
}

// AppendSource appends one logical source line to the node.
func (n *BlockMathNode) AppendSource(line []byte) {
	n.Source = append(n.Source, line...)
}

// FenceLength returns the opening dollar fence length.
func (n *BlockMathNode) FenceLength() int {
	return n.fence
}

// IsRaw prevents Goldmark from parsing math contents as Markdown.
func (*BlockMathNode) IsRaw() bool {
	return true
}

// Kind returns KindBlockMath.
func (*BlockMathNode) Kind() gast.NodeKind {
	return KindBlockMath
}

// Dump implements Node.Dump for debugging.
func (n *BlockMathNode) Dump(source []byte, level int) {
	gast.DumpHelper(n, source, level, map[string]string{
		"FenceLength": fmt.Sprintf("%d", n.fence),
		"Source":      string(n.Source),
	}, nil)
}
