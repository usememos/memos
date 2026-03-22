package renderer

import (
	"bytes"
	"fmt"
	"strings"

	gast "github.com/yuin/goldmark/ast"
	east "github.com/yuin/goldmark/extension/ast"

	mast "github.com/usememos/memos/plugin/markdown/ast"
)

// MarkdownRenderer renders goldmark AST back to markdown text.
type MarkdownRenderer struct {
	buf *bytes.Buffer
}

// NewMarkdownRenderer creates a new markdown renderer.
func NewMarkdownRenderer() *MarkdownRenderer {
	return &MarkdownRenderer{
		buf: &bytes.Buffer{},
	}
}

// Render renders the AST node to markdown and returns the result.
func (r *MarkdownRenderer) Render(node gast.Node, source []byte) string {
	r.buf.Reset()
	r.renderNode(node, source, 0)
	return r.buf.String()
}

// renderNode renders a single node and its children.
func (r *MarkdownRenderer) renderNode(node gast.Node, source []byte, depth int) {
	switch n := node.(type) {
	case *gast.Document:
		r.renderChildren(n, source, depth)

	case *gast.Paragraph:
		r.renderChildren(n, source, depth)
		if node.NextSibling() != nil {
			r.buf.WriteString("\n\n")
		}

	case *gast.Text:
		// Text nodes store their content as segments in the source
		segment := n.Segment
		r.buf.Write(segment.Value(source))
		if n.SoftLineBreak() {
			r.buf.WriteByte('\n')
		} else if n.HardLineBreak() {
			r.buf.WriteString("  \n")
		}

	case *gast.CodeSpan:
		r.buf.WriteByte('`')
		r.renderChildren(n, source, depth)
		r.buf.WriteByte('`')

	case *gast.Emphasis:
		symbol := "*"
		if n.Level == 2 {
			symbol = "**"
		}
		r.buf.WriteString(symbol)
		r.renderChildren(n, source, depth)
		r.buf.WriteString(symbol)

	case *gast.Link:
		r.buf.WriteString("[")
		r.renderChildren(n, source, depth)
		r.buf.WriteString("](")
		r.buf.Write(n.Destination)
		if len(n.Title) > 0 {
			r.buf.WriteString(` "`)
			r.buf.Write(n.Title)
			r.buf.WriteString(`"`)
		}
		r.buf.WriteString(")")

	case *gast.AutoLink:
		url := n.URL(source)
		if n.AutoLinkType == gast.AutoLinkEmail {
			r.buf.WriteString("<")
			r.buf.Write(url)
			r.buf.WriteString(">")
		} else {
			r.buf.Write(url)
		}

	case *gast.Image:
		r.buf.WriteString("![")
		r.renderChildren(n, source, depth)
		r.buf.WriteString("](")
		r.buf.Write(n.Destination)
		if len(n.Title) > 0 {
			r.buf.WriteString(` "`)
			r.buf.Write(n.Title)
			r.buf.WriteString(`"`)
		}
		r.buf.WriteString(")")

	case *gast.Heading:
		r.buf.WriteString(strings.Repeat("#", n.Level))
		r.buf.WriteByte(' ')
		r.renderChildren(n, source, depth)
		if node.NextSibling() != nil {
			r.buf.WriteString("\n\n")
		}

	case *gast.CodeBlock, *gast.FencedCodeBlock:
		r.renderCodeBlock(n, source)

	case *gast.Blockquote:
		// Render each child line with "> " prefix
		r.renderBlockquote(n, source, depth)
		if node.NextSibling() != nil {
			r.buf.WriteString("\n\n")
		}

	case *gast.List:
		r.renderChildren(n, source, depth)
		if node.NextSibling() != nil {
			r.buf.WriteString("\n\n")
		}

	case *gast.ListItem:
		r.renderListItem(n, source, depth)

	case *gast.ThematicBreak:
		r.buf.WriteString("---")
		if node.NextSibling() != nil {
			r.buf.WriteString("\n\n")
		}

	case *east.Strikethrough:
		r.buf.WriteString("~~")
		r.renderChildren(n, source, depth)
		r.buf.WriteString("~~")

	case *east.TaskCheckBox:
		if n.IsChecked {
			r.buf.WriteString("[x] ")
		} else {
			r.buf.WriteString("[ ] ")
		}

	case *east.Table:
		r.renderTable(n, source)
		if node.NextSibling() != nil {
			r.buf.WriteString("\n\n")
		}

	// Custom Memos nodes
	case *mast.TagNode:
		r.buf.WriteByte('#')
		r.buf.Write(n.Tag)

	default:
		// For unknown nodes, try to render children
		r.renderChildren(n, source, depth)
	}
}

// renderChildren renders all children of a node.
func (r *MarkdownRenderer) renderChildren(node gast.Node, source []byte, depth int) {
	child := node.FirstChild()
	for child != nil {
		r.renderNode(child, source, depth+1)
		child = child.NextSibling()
	}
}

// renderCodeBlock renders a code block.
func (r *MarkdownRenderer) renderCodeBlock(node gast.Node, source []byte) {
	if fenced, ok := node.(*gast.FencedCodeBlock); ok {
		// Fenced code block with language
		r.buf.WriteString("```")
		if lang := fenced.Language(source); len(lang) > 0 {
			r.buf.Write(lang)
		}
		r.buf.WriteByte('\n')

		// Write all lines
		lines := fenced.Lines()
		for i := 0; i < lines.Len(); i++ {
			line := lines.At(i)
			r.buf.Write(line.Value(source))
		}

		r.buf.WriteString("```")
		if node.NextSibling() != nil {
			r.buf.WriteString("\n\n")
		}
	} else if codeBlock, ok := node.(*gast.CodeBlock); ok {
		// Indented code block
		lines := codeBlock.Lines()
		for i := 0; i < lines.Len(); i++ {
			line := lines.At(i)
			r.buf.WriteString("    ")
			r.buf.Write(line.Value(source))
		}
		if node.NextSibling() != nil {
			r.buf.WriteString("\n\n")
		}
	}
}

// renderBlockquote renders a blockquote with "> " prefix.
func (r *MarkdownRenderer) renderBlockquote(node *gast.Blockquote, source []byte, depth int) {
	// Create a temporary buffer for the blockquote content
	tempBuf := &bytes.Buffer{}
	tempRenderer := &MarkdownRenderer{buf: tempBuf}
	tempRenderer.renderChildren(node, source, depth)

	// Add "> " prefix to each line
	content := tempBuf.String()
	lines := strings.Split(strings.TrimRight(content, "\n"), "\n")
	for i, line := range lines {
		r.buf.WriteString("> ")
		r.buf.WriteString(line)
		if i < len(lines)-1 {
			r.buf.WriteByte('\n')
		}
	}
}

// renderListItem renders a list item with proper indentation and markers.
func (r *MarkdownRenderer) renderListItem(node *gast.ListItem, source []byte, depth int) {
	parent := node.Parent()
	list, ok := parent.(*gast.List)
	if !ok {
		r.renderChildren(node, source, depth)
		return
	}

	// Add indentation only for nested lists
	// Document=0, List=1, ListItem=2 (no indent), nested ListItem=3+ (indent)
	if depth > 2 {
		indent := strings.Repeat("  ", depth-2)
		r.buf.WriteString(indent)
	}

	// Add list marker
	if list.IsOrdered() {
		fmt.Fprintf(r.buf, "%d. ", list.Start)
		list.Start++ // Increment for next item
	} else {
		r.buf.WriteString("- ")
	}

	// Render content
	r.renderChildren(node, source, depth)

	// Add newline if there's a next sibling
	if node.NextSibling() != nil {
		r.buf.WriteByte('\n')
	}
}

// renderTable renders a table in markdown format.
func (r *MarkdownRenderer) renderTable(table *east.Table, source []byte) {
	// This is a simplified table renderer
	// A full implementation would need to handle alignment, etc.
	r.renderChildren(table, source, 0)
}
