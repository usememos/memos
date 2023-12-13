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
	context *RendererContext
}

type RendererContext struct {
}

// NewHTMLRenderer creates a new HTMLRenderer.
func NewHTMLRenderer() *HTMLRenderer {
	return &HTMLRenderer{
		output:  new(bytes.Buffer),
		context: &RendererContext{},
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
	case *ast.BoldItalic:
		r.output.WriteString("<strong><em>")
		r.output.WriteString(n.Content)
		r.output.WriteString("</em></strong>")
	case *ast.Bold:
		r.output.WriteString("<strong>")
		r.output.WriteString(n.Content)
		r.output.WriteString("</strong>")
	case *ast.Italic:
		r.output.WriteString("<em>")
		r.output.WriteString(n.Content)
		r.output.WriteString("</em>")
	case *ast.Code:
		r.output.WriteString("<code>")
		r.output.WriteString(n.Content)
		r.output.WriteString("</code>")
	case *ast.Link:
		r.output.WriteString(`<a href="`)
		r.output.WriteString(n.URL)
		r.output.WriteString(`">`)
		r.output.WriteString(n.Text)
		r.output.WriteString("</a>")
	case *ast.Image:
		r.output.WriteString(`<img src="`)
		r.output.WriteString(n.URL)
		r.output.WriteString(`" alt="`)
		r.output.WriteString(n.AltText)
		r.output.WriteString(`" />`)
	case *ast.Tag:
		r.output.WriteString(`<span>`)
		r.output.WriteString(`# `)
		r.output.WriteString(n.Content)
		r.output.WriteString(`</span>`)
	case *ast.Strikethrough:
		r.output.WriteString(`<del>`)
		r.output.WriteString(n.Content)
		r.output.WriteString(`</del>`)
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
