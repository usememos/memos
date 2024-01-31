package v2

import (
	"github.com/yourselfhosted/gomark/ast"
)

func traverseASTNodes(nodes []ast.Node, fn func(ast.Node)) {
	for _, node := range nodes {
		fn(node)
		switch n := node.(type) {
		case *ast.Paragraph:
			traverseASTNodes(n.Children, fn)
		case *ast.Heading:
			traverseASTNodes(n.Children, fn)
		case *ast.Blockquote:
			traverseASTNodes(n.Children, fn)
		case *ast.OrderedList:
			traverseASTNodes(n.Children, fn)
		case *ast.UnorderedList:
			traverseASTNodes(n.Children, fn)
		case *ast.TaskList:
			traverseASTNodes(n.Children, fn)
		case *ast.Bold:
			traverseASTNodes(n.Children, fn)
		}
	}
}
