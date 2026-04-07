package extensions

import (
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/util"

	mparser "github.com/usememos/memos/internal/markdown/parser"
)

type mentionExtension struct{}

// MentionExtension is a goldmark extension for @mention syntax.
var MentionExtension = &mentionExtension{}

// Extend extends the goldmark parser with mention support.
func (*mentionExtension) Extend(m goldmark.Markdown) {
	m.Parser().AddOptions(
		parser.WithInlineParsers(
			// Priority 200 - run before standard link parser (500).
			util.Prioritized(mparser.NewMentionParser(), 200),
		),
	)
}
