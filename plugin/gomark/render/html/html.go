package html

import (
	"bytes"
	"fmt"

	"github.com/usememos/memos/plugin/gomark/ast"
)

// HTMLRender is a simple renderer that converts AST to HTML.
type HTMLRender struct {
	output  *bytes.Buffer
	context *RendererContext
}

type RendererContext struct {
}

// NewHTMLRender creates a new HTMLRender.
func NewHTMLRender() *HTMLRender {
	return &HTMLRender{
		output:  new(bytes.Buffer),
		context: &RendererContext{},
	}
}

// RenderNode renders a single AST node to HTML.
func (r *HTMLRender) RenderNode(node ast.Node) {
	switch n := node.(type) {
	case *ast.LineBreak:
		r.renderLineBreak(n)
	case *ast.Paragraph:
		r.renderParagraph(n)
	case *ast.CodeBlock:
		r.renderCodeBlock(n)
	case *ast.Heading:
		r.renderHeading(n)
	case *ast.HorizontalRule:
		r.renderHorizontalRule(n)
	case *ast.Blockquote:
		r.renderBlockquote(n)
	case *ast.Bold:
		r.renderBold(n)
	case *ast.Italic:
		r.renderItalic(n)
	case *ast.BoldItalic:
		r.renderBoldItalic(n)
	case *ast.Code:
		r.renderCode(n)
	case *ast.Image:
		r.renderImage(n)
	case *ast.Link:
		r.renderLink(n)
	case *ast.Tag:
		r.renderTag(n)
	case *ast.Strikethrough:
		r.renderStrikethrough(n)
	case *ast.Text:
		r.renderText(n)
	default:
		// Handle other block types if needed.
	}
}

// RenderNodes renders a slice of AST nodes to HTML.
func (r *HTMLRender) RenderNodes(nodes []ast.Node) {
	for _, node := range nodes {
		r.RenderNode(node)
	}
}

// Render renders the AST to HTML.
func (r *HTMLRender) Render(astRoot []ast.Node) string {
	r.RenderNodes(astRoot)
	return r.output.String()
}

func (r *HTMLRender) renderLineBreak(_ *ast.LineBreak) {
	r.output.WriteString("<br>")
}

func (r *HTMLRender) renderParagraph(node *ast.Paragraph) {
	r.output.WriteString("<p>")
	r.RenderNodes(node.Children)
	r.output.WriteString("</p>")
}

func (r *HTMLRender) renderCodeBlock(node *ast.CodeBlock) {
	r.output.WriteString("<pre><code>")
	r.output.WriteString(node.Content)
	r.output.WriteString("</code></pre>")
}

func (r *HTMLRender) renderHeading(node *ast.Heading) {
	element := fmt.Sprintf("<h%d>", node.Level)
	r.output.WriteString(fmt.Sprintf("<%s>", element))
	r.RenderNodes(node.Children)
	r.output.WriteString(fmt.Sprintf("</%s>", element))
}

func (r *HTMLRender) renderHorizontalRule(_ *ast.HorizontalRule) {
	r.output.WriteString("<hr>")
}

func (r *HTMLRender) renderBlockquote(node *ast.Blockquote) {
	prevSibling, nextSibling := node.PrevSibling(), node.NextSibling()
	if prevSibling == nil || prevSibling.Type() != ast.BlockquoteNode {
		r.output.WriteString("<blockquote>")
	}
	r.RenderNodes(node.Children)
	if nextSibling == nil || nextSibling.Type() != ast.BlockquoteNode {
		r.output.WriteString("</blockquote>")
	}
}

func (r *HTMLRender) renderText(node *ast.Text) {
	r.output.WriteString(node.Content)
}

func (r *HTMLRender) renderBold(node *ast.Bold) {
	r.output.WriteString("<strong>")
	r.output.WriteString(node.Content)
	r.output.WriteString("</strong>")
}

func (r *HTMLRender) renderItalic(node *ast.Italic) {
	r.output.WriteString("<em>")
	r.output.WriteString(node.Content)
	r.output.WriteString("</em>")
}

func (r *HTMLRender) renderBoldItalic(node *ast.BoldItalic) {
	r.output.WriteString("<strong><em>")
	r.output.WriteString(node.Content)
	r.output.WriteString("</em></strong>")
}

func (r *HTMLRender) renderCode(node *ast.Code) {
	r.output.WriteString("<code>")
	r.output.WriteString(node.Content)
	r.output.WriteString("</code>")
}

func (r *HTMLRender) renderImage(node *ast.Image) {
	r.output.WriteString(`<img src="`)
	r.output.WriteString(node.URL)
	r.output.WriteString(`" alt="`)
	r.output.WriteString(node.AltText)
	r.output.WriteString(`" />`)
}

func (r *HTMLRender) renderLink(node *ast.Link) {
	r.output.WriteString(`<a href="`)
	r.output.WriteString(node.URL)
	r.output.WriteString(`">`)
	r.output.WriteString(node.Text)
	r.output.WriteString("</a>")
}

func (r *HTMLRender) renderTag(node *ast.Tag) {
	r.output.WriteString(`<span>`)
	r.output.WriteString(`# `)
	r.output.WriteString(node.Content)
	r.output.WriteString(`</span>`)
}

func (r *HTMLRender) renderStrikethrough(node *ast.Strikethrough) {
	r.output.WriteString(`<del>`)
	r.output.WriteString(node.Content)
	r.output.WriteString(`</del>`)
}
