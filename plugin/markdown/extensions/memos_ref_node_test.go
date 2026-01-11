package extensions

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/yuin/goldmark"
	gast "github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/text"
)

func TestMemosRefExtensionMarksLinkNodes(t *testing.T) {
	md := goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,
			MemosRefExtension,
		),
	)

	src := []byte("[memo](memos/abc-XYZ_9) and [other](https://example.com)")
	doc := md.Parser().Parse(text.NewReader(src))

	var links []*gast.Link
	err := gast.Walk(doc, func(n gast.Node, entering bool) (gast.WalkStatus, error) {
		if !entering {
			return gast.WalkContinue, nil
		}
		if l, ok := n.(*gast.Link); ok {
			links = append(links, l)
		}
		return gast.WalkContinue, nil
	})
	require.NoError(t, err)
	require.Len(t, links, 2)

	id0, ok0 := links[0].AttributeString(AttrMemosRefID)
	id1, ok1 := links[1].AttributeString(AttrMemosRefID)

	// One of them should be marked as memos ref, the other should not.
	if ok0 {
		assert.Equal(t, "abc-XYZ_9", id0)
		assert.False(t, ok1)
	} else {
		require.True(t, ok1)
		assert.Equal(t, "abc-XYZ_9", id1)
		assert.False(t, ok0)
	}
}
