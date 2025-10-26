package extensions

import (
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/util"

	mparser "github.com/usememos/memos/plugin/markdown/parser"
)

type wikilinkExtension struct{}

// WikilinkExtension is a goldmark extension for [[...]] wikilink syntax
var WikilinkExtension = &wikilinkExtension{}

// Extend extends the goldmark parser with wikilink support.
func (*wikilinkExtension) Extend(m goldmark.Markdown) {
	m.Parser().AddOptions(
		parser.WithInlineParsers(
			// Priority 199 - run before standard link parser (500) but after tags (200)
			util.Prioritized(mparser.NewWikilinkParser(), 199),
		),
	)
}
