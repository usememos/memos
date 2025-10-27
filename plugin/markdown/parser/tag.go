package parser

import (
	gast "github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"

	mast "github.com/usememos/memos/plugin/markdown/ast"
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

// Parse parses #tag syntax.
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

	// Scan tag characters
	// Valid: alphanumeric, dash, underscore, forward slash
	tagEnd := 1 // Start after #
	for tagEnd < len(line) {
		c := line[tagEnd]

		isValid := (c >= 'a' && c <= 'z') ||
			(c >= 'A' && c <= 'Z') ||
			(c >= '0' && c <= '9') ||
			c == '-' || c == '_' || c == '/'

		if !isValid {
			break
		}

		tagEnd++
	}

	// Must have at least one character after #
	if tagEnd == 1 {
		return nil
	}

	// Extract tag (without #)
	tagName := line[1:tagEnd]

	// Make a copy of the tag name
	tagCopy := make([]byte, len(tagName))
	copy(tagCopy, tagName)

	// Advance reader
	block.Advance(tagEnd)

	// Create node
	node := &mast.TagNode{
		Tag: tagCopy,
	}

	return node
}
