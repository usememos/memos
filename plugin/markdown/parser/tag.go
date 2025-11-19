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
	// Tags include Unicode letters, digits, underscore, hyphen, forward slash
	// Stop at: whitespace, punctuation (except - _ /)
	// This follows the Twitter/social media standard for hashtag parsing
	tagEnd := 1 // Start after #
	for tagEnd < len(line) {
		c := line[tagEnd]

		// ASCII fast path for common characters
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
			(c >= '0' && c <= '9') || c == '_' || c == '-' || c == '/' {
			tagEnd++
			continue
		}

		// Stop at whitespace
		if c == ' ' || c == '\t' || c == '\n' || c == '\r' {
			break
		}

		// Stop at common ASCII punctuation
		if c == '.' || c == ',' || c == ';' || c == ':' ||
			c == '!' || c == '?' || c == '(' || c == ')' ||
			c == '[' || c == ']' || c == '{' || c == '}' ||
			c == '<' || c == '>' || c == '"' || c == '\'' ||
			c == '`' || c == '|' || c == '\\' || c == '@' ||
			c == '&' || c == '*' || c == '+' || c == '=' ||
			c == '^' || c == '%' || c == '$' || c == '~' || c == '#' {
			break
		}

		// For UTF-8 multibyte sequences, check for Unicode punctuation
		// U+3000 (IDEOGRAPHIC SPACE) - treat as space
		// U+3001-U+303F - CJK punctuation
		// U+FF00-U+FFEF - Fullwidth punctuation
		if c >= 0x80 && tagEnd+2 < len(line) {
			b1, b2, b3 := line[tagEnd], line[tagEnd+1], line[tagEnd+2]
			
			// U+3000 IDEOGRAPHIC SPACE (E3 80 80)
			if b1 == 0xE3 && b2 == 0x80 && b3 == 0x80 {
				break
			}
			
			// U+3001-U+303F CJK punctuation (E3 80 81 to E3 80 BF)
			if b1 == 0xE3 && b2 == 0x80 && b3 >= 0x81 && b3 <= 0xBF {
				break
			}
			
			// Common fullwidth punctuation: ！？，。；：（）
			// U+FF01 ！ (EF BC 81), U+FF1F ？ (EF BC 9F)
			// U+FF0C ， (EF BC 8C), U+FF0E 。 (EF BC 8E)
			// U+FF1A ： (EF BC 9A), U+FF1B ； (EF BC 9B)
			// U+FF08 （ (EF BC 88), U+FF09 ） (EF BC 89)
			if b1 == 0xEF && b2 == 0xBC {
				if b3 == 0x81 || b3 == 0x88 || b3 == 0x89 ||
					b3 == 0x8C || b3 == 0x8E ||
					b3 == 0x9A || b3 == 0x9B || b3 == 0x9F {
					break
				}
			}
		}

		// Allow Unicode letters and other characters
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
