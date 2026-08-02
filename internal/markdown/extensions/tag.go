package extensions

import (
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	east "github.com/yuin/goldmark/extension/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer"
	"github.com/yuin/goldmark/text"
	"github.com/yuin/goldmark/util"

	mast "github.com/usememos/memos/internal/markdown/ast"
	mparser "github.com/usememos/memos/internal/markdown/parser"
)

type tagExtension struct{}

// TagExtension is a goldmark extension for #tag syntax.
var TagExtension = &tagExtension{}

// Extend extends the goldmark parser with tag support.
func (*tagExtension) Extend(m goldmark.Markdown) {
	m.Parser().AddOptions(
		parser.WithBlockParsers(
			util.Prioritized(mparser.NewBlockMathParser(), 750),
		),
		parser.WithInlineParsers(
			util.Prioritized(mparser.NewInlineMathParser(), 150),
		),
		parser.WithASTTransformers(
			// Run after GFM has resolved emphasis, links, tables, and other syntax.
			util.Prioritized(&tagASTTransformer{}, 1000),
		),
	)
	m.Renderer().AddOptions(
		renderer.WithNodeRenderers(
			util.Prioritized(&tagNodeRenderer{}, 500),
		),
	)
}

type tagASTTransformer struct{}

func (*tagASTTransformer) Transform(document *ast.Document, reader text.Reader, _ parser.Context) {
	source := reader.Source()
	textNodes := eligibleLiteralTextNodes(document)
	mergeAdjacentLiteralText(textNodes, source)
	for _, textNode := range textNodes {
		if textNode.Parent() == nil {
			continue
		}
		replaceTagsInText(textNode, source)
	}
}

func mergeAdjacentLiteralText(textNodes []*ast.Text, source []byte) {
	for _, textNode := range textNodes {
		parent := textNode.Parent()
		if parent == nil {
			continue
		}
		for {
			nextText, ok := textNode.NextSibling().(*ast.Text)
			if !ok || !isEligibleLiteralText(nextText) || !textNode.Merge(nextText, source) {
				break
			}
			parent.RemoveChild(parent, nextText)
		}
	}
}

func isEligibleLiteralText(textNode *ast.Text) bool {
	if textNode.IsRaw() {
		return false
	}
	for parent := textNode.Parent(); parent != nil; parent = parent.Parent() {
		switch parent.Kind() {
		case ast.KindDocument,
			ast.KindTextBlock,
			ast.KindParagraph,
			ast.KindHeading,
			ast.KindEmphasis,
			ast.KindBlockquote,
			ast.KindList,
			ast.KindListItem,
			east.KindStrikethrough,
			east.KindTable,
			east.KindTableRow,
			east.KindTableHeader,
			east.KindTableCell:
			// Explicitly transparent GFM text containers.
		default:
			return false
		}
	}
	return true
}

func replaceTagsInText(textNode *ast.Text, source []byte) {
	segment := textNode.Segment
	matches := mparser.FindTagMatches(segment.Value(source))
	if len(matches) == 0 {
		return
	}

	parent := textNode.Parent()
	cursor := segment.Start
	padding := segment.Padding
	for _, match := range matches {
		start := segment.Start + match.Start - segment.Padding
		end := segment.Start + match.End - segment.Padding
		if start > cursor || padding > 0 {
			insertSplitTextBefore(parent, textNode, textNode, text.NewSegmentPadding(cursor, start, padding), false)
		}

		tagNode := &mast.TagNode{
			Tag:    append([]byte(nil), match.Value...),
			Source: append([]byte(nil), source[start:end]...),
		}
		tagNode.SetPos(start)
		parent.InsertBefore(parent, textNode, tagNode)
		cursor = end
		padding = 0
	}

	if cursor < segment.Stop || textNode.SoftLineBreak() || textNode.HardLineBreak() {
		insertSplitTextBefore(parent, textNode, textNode, text.NewSegment(cursor, segment.Stop), true)
	}
	parent.RemoveChild(parent, textNode)
}

func insertSplitTextBefore(parent ast.Node, before ast.Node, original *ast.Text, segment text.Segment, keepLineBreak bool) {
	newText := ast.NewTextSegment(segment)
	newText.SetRaw(original.IsRaw())
	if keepLineBreak {
		newText.SetSoftLineBreak(original.SoftLineBreak())
		newText.SetHardLineBreak(original.HardLineBreak())
	}
	parent.InsertBefore(parent, before, newText)
}

type tagNodeRenderer struct{}

func (*tagNodeRenderer) RegisterFuncs(registerer renderer.NodeRendererFuncRegisterer) {
	registerer.Register(mast.KindTag, renderTagNode)
	registerer.Register(mast.KindInlineMath, renderMathNode)
	registerer.Register(mast.KindBlockMath, renderMathNode)
}

func renderTagNode(writer util.BufWriter, _ []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	if !entering {
		return ast.WalkContinue, nil
	}
	tagNode, ok := node.(*mast.TagNode)
	if !ok {
		return ast.WalkContinue, nil
	}
	spelling := tagNode.Source
	if len(spelling) == 0 {
		spelling = append([]byte{'#'}, tagNode.Tag...)
	}
	_, _ = writer.Write(util.EscapeHTML(spelling))
	return ast.WalkContinue, nil
}

func renderMathNode(writer util.BufWriter, _ []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	if !entering {
		return ast.WalkContinue, nil
	}
	var source []byte
	switch mathNode := node.(type) {
	case *mast.InlineMathNode:
		source = mathNode.Source
	case *mast.BlockMathNode:
		source = mathNode.Source
	default:
		return ast.WalkContinue, nil
	}
	_, _ = writer.Write(util.EscapeHTML(source))
	return ast.WalkContinue, nil
}
