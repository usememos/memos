package html

import (
	"bytes"
	"fmt"

	"github.com/usememos/memos/plugin/gomark/ast"
)

// HTMLRenderer is a simple renderer that converts AST to HTML.
// nolint
type HTMLRenderer struct {
	output  *bytes.Buffer
	context *renderContext
}

type renderContext struct {
}

// NewHTMLRenderer creates a new HTMLRenderer.
func NewHTMLRenderer() *HTMLRenderer {
	return &HTMLRenderer{
		output:  new(bytes.Buffer),
		context: &renderContext{},
	}
}

// RenderNode renders a single AST node to HTML.
func (r *HTMLRenderer) RenderNode(node ast.Node) {
	prevSibling, nextSibling := node.GetPrevSibling(), node.GetNextSibling()

	switch n := node.(type) {
	case *ast.LineBreak:
		r.output.WriteString("<br>")
	case *ast.Paragraph:
		r.output.WriteString("<p>")
		r.RenderNodes(n.Children)
		r.output.WriteString("</p>")
	case *ast.CodeBlock:
		r.output.WriteString("<pre><code>")
		r.output.WriteString(n.Content)
		r.output.WriteString("</code></pre>")
	case *ast.Heading:
		r.output.WriteString(fmt.Sprintf("<h%d>", n.Level))
		r.RenderNodes(n.Children)
		r.output.WriteString(fmt.Sprintf("</h%d>", n.Level))
	case *ast.HorizontalRule:
		r.output.WriteString("<hr>")
	case *ast.Blockquote:
		if prevSibling == nil || prevSibling.Type() != ast.NodeTypeBlockquote {
			r.output.WriteString("<blockquote>")
		}
		r.RenderNodes(n.Children)
		if nextSibling != nil && nextSibling.Type() == ast.NodeTypeBlockquote {
			r.RenderNode(nextSibling)
		}
		if prevSibling == nil || prevSibling.Type() != ast.NodeTypeBlockquote {
			r.output.WriteString("</blockquote>")
		}
	case *ast.Text:
		r.output.WriteString(n.Content)
	default:
		// Handle other block types if needed.
	}
}

// RenderNodes renders a slice of AST nodes to HTML.
func (r *HTMLRenderer) RenderNodes(nodes []ast.Node) {
	for _, node := range nodes {
		prevSibling := node.GetPrevSibling()
		if prevSibling != nil {
			if prevSibling.Type() == node.Type() {
				if node.Type() == ast.NodeTypeBlockquote {
					continue
				}
			}
		}

		r.RenderNode(node)
	}
}

// Render renders the AST to HTML.
func (r *HTMLRenderer) Render(astRoot []ast.Node) string {
	r.RenderNodes(astRoot)
	return r.output.String()
}
