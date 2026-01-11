package extensions

import (
	"bytes"

	"github.com/yuin/goldmark"
	gast "github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
	"github.com/yuin/goldmark/util"
)

type memosRefExtension struct{}

// MemosRefExtension marks Link nodes whose destination contains a `memos/<id>` segment.
//
// It annotates the existing goldmark `*ast.Link` node with an attribute
var MemosRefExtension = &memosRefExtension{}

const (
	// AttrMemosRefID is stored on `*ast.Link` when a `memos/<id>` segment is detected.
	AttrMemosRefID = "memosRefId"
)

func (*memosRefExtension) Extend(m goldmark.Markdown) {
	m.Parser().AddOptions(
		parser.WithASTTransformers(
			// Run after the built-in link parser has produced Link nodes.
			util.Prioritized(&memosRefLinkMarker{}, 200),
		),
	)
}

type memosRefLinkMarker struct{}

func (*memosRefLinkMarker) Transform(doc *gast.Document, _ text.Reader, _ parser.Context) {
	_ = gast.Walk(doc, func(n gast.Node, entering bool) (gast.WalkStatus, error) {
		if !entering {
			return gast.WalkContinue, nil
		}

		link, ok := n.(*gast.Link)
		if !ok {
			return gast.WalkContinue, nil
		}

		// Don't overwrite if already set.
		if _, found := link.AttributeString(AttrMemosRefID); found {
			return gast.WalkContinue, nil
		}

		id, ok := extractMemosIDFromDest(link.Destination)
		if !ok {
			return gast.WalkContinue, nil
		}

		// Store as string (detached from the parser buffer).
		link.SetAttributeString(AttrMemosRefID, id)
		return gast.WalkContinue, nil
	})
}

func extractMemosIDFromDest(dest []byte) (string, bool) {
	const prefix = "memos/"
	idx := bytes.Index(dest, []byte(prefix))
	if idx < 0 {
		return "", false
	}

	start := idx + len(prefix)
	if start >= len(dest) {
		return "", false
	}

	end := start
	for end < len(dest) && isValidMemosIDByte(dest[end]) {
		end++
	}
	if end == start {
		return "", false
	}

	return string(dest[start:end]), true
}

func isValidMemosIDByte(b byte) bool {
	return (b >= '0' && b <= '9') ||
		(b >= 'a' && b <= 'z') ||
		(b >= 'A' && b <= 'Z') ||
		b == '-' || b == '_'
}
