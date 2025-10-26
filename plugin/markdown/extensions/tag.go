package extensions

import (
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/util"

	mparser "github.com/usememos/memos/plugin/markdown/parser"
)

type tagExtension struct{}

// TagExtension is a goldmark extension for #tag syntax.
var TagExtension = &tagExtension{}

// Extend extends the goldmark parser with tag support.
func (*tagExtension) Extend(m goldmark.Markdown) {
	m.Parser().AddOptions(
		parser.WithInlineParsers(
			// Priority 200 - run before standard link parser (500)
			util.Prioritized(mparser.NewTagParser(), 200),
		),
	)
}
