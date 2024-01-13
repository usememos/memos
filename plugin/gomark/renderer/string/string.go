package string

import (
	"bytes"
	"fmt"

	"github.com/usememos/memos/plugin/gomark/ast"
)

// StringRenderer renders AST to raw string.
type StringRenderer struct {
	output  *bytes.Buffer
	context *RendererContext
}

type RendererContext struct {
}

// NewStringRenderer creates a new StringRender.
func NewStringRenderer() *StringRenderer {
	return &StringRenderer{
		output:  new(bytes.Buffer),
		context: &RendererContext{},
	}
}

// RenderNode renders a single AST node to raw string.
func (r *StringRenderer) RenderNode(node ast.Node) {
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
	case *ast.TaskList:
		r.renderTaskList(n)
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
	case *ast.EscapingCharacter:
		r.renderEscapingCharacter(n)
	case *ast.Text:
		r.renderText(n)
	default:
		// Handle other block types if needed.
	}
}

// RenderNodes renders a slice of AST nodes to raw string.
func (r *StringRenderer) RenderNodes(nodes []ast.Node) {
	var prevNode ast.Node
	var skipNextLineBreakFlag bool
	for _, node := range nodes {
		if node.Type() == ast.LineBreakNode && skipNextLineBreakFlag {
			if prevNode != nil && ast.IsBlockNode(prevNode) {
				skipNextLineBreakFlag = false
				continue
			}
		}

		r.RenderNode(node)
		prevNode = node
		skipNextLineBreakFlag = true
	}
}

// Render renders the AST to raw string.
func (r *StringRenderer) Render(astRoot []ast.Node) string {
	r.RenderNodes(astRoot)
	return r.output.String()
}

func (r *StringRenderer) renderLineBreak(_ *ast.LineBreak) {
	r.output.WriteString("\n")
}

func (r *StringRenderer) renderParagraph(node *ast.Paragraph) {
	r.RenderNodes(node.Children)
	r.output.WriteString("\n")
}

func (r *StringRenderer) renderCodeBlock(node *ast.CodeBlock) {
	r.output.WriteString(node.Content)
}

func (r *StringRenderer) renderHeading(node *ast.Heading) {
	r.RenderNodes(node.Children)
	r.output.WriteString("\n")
}

func (r *StringRenderer) renderHorizontalRule(_ *ast.HorizontalRule) {
	r.output.WriteString("\n---\n")
}

func (r *StringRenderer) renderBlockquote(node *ast.Blockquote) {
	r.output.WriteString("\n")
	r.RenderNodes(node.Children)
	r.output.WriteString("\n")
}

func (r *StringRenderer) renderTaskList(node *ast.TaskList) {
	r.output.WriteString(node.Symbol)
	r.RenderNodes(node.Children)
	r.output.WriteString("\n")
}

func (r *StringRenderer) renderUnorderedList(node *ast.UnorderedList) {
	r.output.WriteString(node.Symbol)
	r.RenderNodes(node.Children)
	r.output.WriteString("\n")
}

func (r *StringRenderer) renderOrderedList(node *ast.OrderedList) {
	r.output.WriteString(fmt.Sprintf("%s. ", node.Number))
	r.RenderNodes(node.Children)
	r.output.WriteString("\n")
}

func (r *StringRenderer) renderText(node *ast.Text) {
	r.output.WriteString(node.Content)
}

func (r *StringRenderer) renderBold(node *ast.Bold) {
	r.RenderNodes(node.Children)
}

func (r *StringRenderer) renderItalic(node *ast.Italic) {
	r.output.WriteString(node.Content)
}

func (r *StringRenderer) renderBoldItalic(node *ast.BoldItalic) {
	r.output.WriteString(node.Content)
}

func (r *StringRenderer) renderCode(node *ast.Code) {
	r.output.WriteString("`")
	r.output.WriteString(node.Content)
	r.output.WriteString("`")
}

func (r *StringRenderer) renderImage(node *ast.Image) {
	r.output.WriteString(node.AltText)
}

func (r *StringRenderer) renderLink(node *ast.Link) {
	r.output.WriteString(node.Text)
}

func (r *StringRenderer) renderTag(node *ast.Tag) {
	r.output.WriteString(`#`)
	r.output.WriteString(node.Content)
}

func (r *StringRenderer) renderStrikethrough(node *ast.Strikethrough) {
	r.output.WriteString(node.Content)
}

func (r *StringRenderer) renderEscapingCharacter(node *ast.EscapingCharacter) {
	r.output.WriteString("\\")
	r.output.WriteString(node.Symbol)
}
