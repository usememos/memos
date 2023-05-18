package parser

import (
	"strings"

	"github.com/usememos/memos/plugin/gomark/ast"
)

type HeadingTokenizer struct {
}

func NewHeadingTokenizer() *HeadingTokenizer {
	return &HeadingTokenizer{}
}

func (*HeadingTokenizer) Trigger() []byte {
	return []byte{'#'}
}

func (*HeadingTokenizer) Parse(parent *ast.Node, block string) *ast.Node {
	line := block
	level := 0
	for _, c := range line {
		if c == '#' {
			level++
		} else if c == ' ' {
			break
		} else {
			return nil
		}
	}
	if level == 0 || level > 6 {
		return nil
	}
	text := strings.TrimSpace(line[level+1:])
	node := ast.NewNode("h1", text)
	if parent != nil {
		parent.AddChild(node)
	}
	return node
}
