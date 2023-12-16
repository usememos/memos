package string

import (
	"bytes"

	"github.com/usememos/memos/plugin/gomark/ast"
)

// StringRender renders AST to raw string.
type StringRender struct {
	output  *bytes.Buffer
	context *RendererContext
}

type RendererContext struct {
}

// NewStringRender creates a new StringRender.
func NewStringRender() *StringRender {
	return &StringRender{
		output:  new(bytes.Buffer),
		context: &RendererContext{},
	}
}

// RenderNode renders a single AST node to raw string.
func (r *StringRender) RenderNode(node ast.Node) {
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
	case *ast.UnorderedList:
		r.renderUnorderedList(n)
	case *ast.OrderedList:
		r.renderOrderedList(n)
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

// RenderNodes renders a slice of AST nodes to raw string.
func (r *StringRender) RenderNodes(nodes []ast.Node) {
	for _, node := range nodes {
		r.RenderNode(node)
	}
}

// Render renders the AST to raw string.
func (r *StringRender) Render(astRoot []ast.Node) string {
	r.RenderNodes(astRoot)
	return r.output.String()
}

func (r *StringRender) renderLineBreak(_ *ast.LineBreak) {
	r.output.WriteString("\n")
}

func (r *StringRender) renderParagraph(node *ast.Paragraph) {
	r.RenderNodes(node.Children)
}

func (r *StringRender) renderCodeBlock(node *ast.CodeBlock) {
	r.output.WriteString(node.Content)
}

func (r *StringRender) renderHeading(node *ast.Heading) {
	r.RenderNodes(node.Children)
	r.output.WriteString("\n")
}

func (r *StringRender) renderHorizontalRule(_ *ast.HorizontalRule) {
	r.output.WriteString("\n---\n")
}

func (r *StringRender) renderBlockquote(node *ast.Blockquote) {
	r.output.WriteString("\n")
	r.RenderNodes(node.Children)
	r.output.WriteString("\n")
}

func (r *StringRender) renderUnorderedList(node *ast.UnorderedList) {
	prevSibling, nextSibling := node.PrevSibling(), node.NextSibling()
	if prevSibling == nil || prevSibling.Type() != ast.UnorderedListNode {
		r.output.WriteString("\n")
	}
	r.output.WriteString("* ")
	r.RenderNodes(node.Children)
	if nextSibling == nil || nextSibling.Type() != ast.UnorderedListNode {
		r.output.WriteString("\n")
	}
}

func (r *StringRender) renderOrderedList(node *ast.OrderedList) {
	prevSibling, nextSibling := node.PrevSibling(), node.NextSibling()
	if prevSibling == nil || prevSibling.Type() != ast.OrderedListNode {
		r.output.WriteString("\n")
	}
	r.output.WriteString("1. ")
	r.RenderNodes(node.Children)
	if nextSibling == nil || nextSibling.Type() != ast.OrderedListNode {
		r.output.WriteString("\n")
	}
}

func (r *StringRender) renderText(node *ast.Text) {
	r.output.WriteString(node.Content)
}

func (r *StringRender) renderBold(node *ast.Bold) {
	r.output.WriteString(node.Content)
}

func (r *StringRender) renderItalic(node *ast.Italic) {
	r.output.WriteString(node.Content)
}

func (r *StringRender) renderBoldItalic(node *ast.BoldItalic) {
	r.output.WriteString(node.Content)
}

func (r *StringRender) renderCode(node *ast.Code) {
	r.output.WriteString("`")
	r.output.WriteString(node.Content)
	r.output.WriteString("`")
}

func (*StringRender) renderImage(*ast.Image) {
	// Do nothing.
}

func (*StringRender) renderLink(*ast.Link) {
	// Do nothing.
}

func (r *StringRender) renderTag(node *ast.Tag) {
	r.output.WriteString(`#`)
	r.output.WriteString(node.Content)
}

func (r *StringRender) renderStrikethrough(node *ast.Strikethrough) {
	r.output.WriteString(node.Content)
}
