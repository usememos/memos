package restore

import "github.com/usememos/memos/plugin/gomark/ast"

func Restore(nodes []ast.Node) string {
	var result string
	for _, node := range nodes {
		if node == nil {
			continue
		}
		result += node.Restore()
	}
	return result
}
