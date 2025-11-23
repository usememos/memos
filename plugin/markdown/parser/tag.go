package parser

import (
	"unicode"
	"unicode/utf8"

	gast "github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"

	mast "github.com/usememos/memos/plugin/markdown/ast"
)

const (
	// MaxTagLength defines the maximum number of runes allowed in a tag.
	MaxTagLength = 100
)

type tagParser struct{}

// NewTagParser creates a new inline parser for #tag syntax.
func NewTagParser() parser.InlineParser {
	return &tagParser{}
}

// Trigger returns the characters that trigger this parser.
func (*tagParser) Trigger() []byte {
	return []byte{'#'}
}

// isValidTagRune checks if a Unicode rune is valid in a tag.
// Uses Unicode categories for proper international character support.
func isValidTagRune(r rune) bool {
	// Allow Unicode letters (any script: Latin, CJK, Arabic, Cyrillic, etc.)
	if unicode.IsLetter(r) {
		return true
	}

	// Allow Unicode digits
	if unicode.IsNumber(r) {
		return true
	}

	// Allow emoji and symbols (So category: Symbol, Other)
	// This includes emoji, which are essential for social media-style tagging
	if unicode.IsSymbol(r) {
		return true
	}

	// Allow specific ASCII symbols for tag structure
	// Underscore: word separation (snake_case)
	// Hyphen: word separation (kebab-case)
	// Forward slash: hierarchical tags (category/subcategory)
	if r == '_' || r == '-' || r == '/' {
		return true
	}

	return false
}

// Parse parses #tag syntax using Unicode-aware validation.
// Tags support international characters and follow these rules:
//   - Must start with # followed by valid tag characters
//   - Valid characters: Unicode letters, Unicode digits, underscore (_), hyphen (-), forward slash (/)
//   - Maximum length: 100 runes (Unicode characters)
//   - Stops at: whitespace, punctuation, or other invalid characters
func (*tagParser) Parse(_ gast.Node, block text.Reader, _ parser.Context) gast.Node {
	line, _ := block.PeekLine()

	// Must start with #
	if len(line) == 0 || line[0] != '#' {
		return nil
	}

	// Check if it's a heading (## or space after #)
	if len(line) > 1 {
		if line[1] == '#' {
			// It's a heading (##), not a tag
			return nil
		}
		if line[1] == ' ' {
			// Space after # - heading or just a hash
			return nil
		}
	} else {
		// Just a lone #
		return nil
	}

	// Parse tag using UTF-8 aware rune iteration
	tagStart := 1
	pos := tagStart
	runeCount := 0

	for pos < len(line) {
		r, size := utf8.DecodeRune(line[pos:])

		// Stop at invalid UTF-8
		if r == utf8.RuneError && size == 1 {
			break
		}

		// Validate character using Unicode categories
		if !isValidTagRune(r) {
			break
		}

		// Enforce max length (by rune count, not byte count)
		runeCount++
		if runeCount > MaxTagLength {
			break
		}

		pos += size
	}

	// Must have at least one character after #
	if pos <= tagStart {
		return nil
	}

	// Extract tag (without #)
	tagName := line[tagStart:pos]

	// Make a copy of the tag name
	tagCopy := make([]byte, len(tagName))
	copy(tagCopy, tagName)

	// Advance reader
	block.Advance(pos)

	// Create node
	node := &mast.TagNode{
		Tag: tagCopy,
	}

	return node
}
