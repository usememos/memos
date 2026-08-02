package extensions

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/text"

	mast "github.com/usememos/memos/internal/markdown/ast"
)

func TestReplaceMentionsInPaddedText(t *testing.T) {
	source := []byte("x@alice")
	paragraph := ast.NewParagraph()
	textNode := ast.NewTextSegment(text.NewSegmentPadding(1, len(source), 2))
	paragraph.AppendChild(paragraph, textNode)

	replaceMentionsInText(textNode, source)

	mention, ok := paragraph.LastChild().(*mast.MentionNode)
	require.True(t, ok)
	assert.Equal(t, "alice", string(mention.Username))
}
