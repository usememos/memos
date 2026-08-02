package renderer

import (
	"bytes"
	"fmt"
	"strings"

	gast "github.com/yuin/goldmark/ast"
	east "github.com/yuin/goldmark/extension/ast"

	mast "github.com/usememos/memos/internal/markdown/ast"
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
			separator := "\n\n"
			if _, nextIsList := node.NextSibling().(*gast.List); nextIsList {
				if item, ok := node.Parent().(*gast.ListItem); ok {
					if list, ok := item.Parent().(*gast.List); ok && list.IsTight {
						separator = "\n"
					}
				}
			}
			r.buf.WriteString(separator)
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
		if start, end, ok := autoLinkLabelRange(n, source); ok {
			if start > 0 && end < len(source) && source[start-1] == '<' && source[end] == '>' {
				r.buf.Write(source[start-1 : end+1])
			} else {
				r.buf.Write(source[start:end])
			}
			break
		}
		url := n.URL(source)
		if n.AutoLinkType == gast.AutoLinkEmail {
			r.buf.WriteByte('<')
			r.buf.Write(url)
			r.buf.WriteByte('>')
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
		if node.PreviousSibling() != nil && !bytes.HasSuffix(r.buf.Bytes(), []byte{'\n'}) {
			r.buf.WriteByte('\n')
		}
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
		if len(n.Source) > 0 {
			r.buf.Write(n.Source)
		} else {
			r.buf.WriteByte('#')
			r.buf.Write(n.Tag)
		}

	case *mast.GFMEmailNode:
		r.buf.Write(n.Source)

	case *mast.InlineMathNode:
		r.buf.Write(n.Source)

	case *mast.BlockMathNode:
		r.buf.Write(n.Source)
		if node.NextSibling() != nil {
			if !bytes.HasSuffix(n.Source, []byte{'\n'}) {
				r.buf.WriteByte('\n')
			}
			r.buf.WriteByte('\n')
		}

	case *mast.MentionNode:
		if len(n.Source) > 0 {
			r.buf.Write(n.Source)
		} else {
			r.buf.WriteByte('@')
			r.buf.Write(n.Username)
		}

	default:
		// For unknown nodes, try to render children
		r.renderChildren(n, source, depth)
	}
}

func autoLinkLabelRange(node *gast.AutoLink, source []byte) (int, int, bool) {
	label := node.Label(source)
	for _, start := range []int{node.Pos(), node.Pos() + 1} {
		if start >= 0 && start <= len(source)-len(label) && bytes.HasPrefix(source[start:], label) {
			return start, start + len(label), true
		}
	}
	return 0, 0, false
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

	// Document=0, List=1, ListItem=2 (no indent), nested ListItem=3+ (indent).
	prefix := ""
	if depth > 2 {
		prefix = strings.Repeat("  ", (depth-2)/2)
	}

	marker := "- "
	if list.IsOrdered() {
		marker = fmt.Sprintf("%d. ", list.Start)
		list.Start++ // Increment for next item
	}

	contentBuffer := &bytes.Buffer{}
	contentRenderer := &MarkdownRenderer{buf: contentBuffer}
	contentRenderer.renderChildren(node, source, depth)
	content := contentBuffer.String()
	contentLines := strings.Split(content, "\n")

	r.buf.WriteString(prefix)
	r.buf.WriteString(marker)
	r.buf.WriteString(contentLines[0])
	continuationIndent := strings.Repeat(" ", len(prefix)+len(marker))
	for index, line := range contentLines[1:] {
		r.buf.WriteByte('\n')
		if line != "" || index < len(contentLines)-2 {
			lineIndent := len(line) - len(strings.TrimLeft(line, " "))
			if lineIndent < len(continuationIndent) {
				r.buf.WriteString(continuationIndent[:len(continuationIndent)-lineIndent])
			}
			r.buf.WriteString(line)
		}
	}

	// Add newline if there's a next sibling
	if node.NextSibling() != nil && !strings.HasSuffix(content, "\n") {
		r.buf.WriteByte('\n')
	}
}

// renderTable renders a table in markdown format.
func (r *MarkdownRenderer) renderTable(table *east.Table, source []byte) {
	// This is a simplified table renderer
	// A full implementation would need to handle alignment, etc.
	r.renderChildren(table, source, 0)
}
