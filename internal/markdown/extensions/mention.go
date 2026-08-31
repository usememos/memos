package extensions

import (
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
	"github.com/yuin/goldmark/util"

	"github.com/usememos/memos/internal/base"
	mast "github.com/usememos/memos/internal/markdown/ast"
	mparser "github.com/usememos/memos/internal/markdown/parser"
)

type mentionExtension struct{}

// MentionExtension is a goldmark extension for username references using @username syntax.
var MentionExtension = &mentionExtension{}

// Extend extends the goldmark parser with username-reference support.
func (*mentionExtension) Extend(m goldmark.Markdown) {
	m.Parser().AddOptions(
		parser.WithASTTransformers(
			// GFM email recognition runs at 950 and tag recognition at 1000.
			util.Prioritized(&mentionASTTransformer{}, 1050),
		),
	)
}

type mentionASTTransformer struct{}

func (*mentionASTTransformer) Transform(document *ast.Document, reader text.Reader, _ parser.Context) {
	source := reader.Source()
	textNodes := eligibleLiteralTextNodes(document)
	mergeAdjacentLiteralText(textNodes, source)
	for _, textNode := range textNodes {
		if textNode.Parent() == nil {
			continue
		}
		replaceMentionsInText(textNode, source)
	}
}

func replaceMentionsInText(textNode *ast.Text, source []byte) {
	segment := textNode.Segment
	runHasLeftBoundary := segment.Padding > 0 || segment.Start == 0 || !base.IsUsernameCharacter(source[segment.Start-1])
	matches := mparser.FindMentionMatches(segment.Value(source), runHasLeftBoundary)
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

		mentionNode := &mast.MentionNode{
			Username: append([]byte(nil), match.Username...),
			Source:   append([]byte(nil), source[start:end]...),
		}
		mentionNode.SetPos(start)
		parent.InsertBefore(parent, textNode, mentionNode)
		cursor = end
		padding = 0
	}

	if cursor < segment.Stop || textNode.SoftLineBreak() || textNode.HardLineBreak() {
		insertSplitTextBefore(parent, textNode, textNode, text.NewSegment(cursor, segment.Stop), true)
	}
	parent.RemoveChild(parent, textNode)
}
