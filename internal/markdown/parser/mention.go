package parser

import (
	"unicode"
	"unicode/utf8"

	gast "github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"

	mast "github.com/usememos/memos/internal/markdown/ast"
)

const (
	// MaxMentionLength matches the username token length accepted by the API.
	MaxMentionLength = 32
)

type mentionParser struct{}

// NewMentionParser creates a new inline parser for @mention syntax.
func NewMentionParser() parser.InlineParser {
	return &mentionParser{}
}

// Trigger returns the characters that trigger this parser.
func (*mentionParser) Trigger() []byte {
	return []byte{'@'}
}

func isValidMentionRune(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsNumber(r) || r == '-'
}

func isMentionBoundary(r rune) bool {
	return unicode.IsSpace(r) || unicode.IsPunct(r) || unicode.IsSymbol(r)
}

// Parse parses @mention syntax while avoiding email-address matches.
func (*mentionParser) Parse(_ gast.Node, block text.Reader, _ parser.Context) gast.Node {
	line, _ := block.PeekLine()
	if len(line) == 0 || line[0] != '@' {
		return nil
	}

	prev := block.PrecendingCharacter()
	if prev != '\n' && !isMentionBoundary(prev) {
		return nil
	}

	start := 1
	pos := start
	runeCount := 0
	hasLetterOrNumber := false

	for pos < len(line) {
		r, size := utf8.DecodeRune(line[pos:])
		if r == utf8.RuneError && size == 1 {
			break
		}
		if !isValidMentionRune(r) {
			break
		}
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			hasLetterOrNumber = true
		}
		runeCount++
		if runeCount > MaxMentionLength {
			break
		}
		pos += size
	}

	if pos <= start || !hasLetterOrNumber {
		return nil
	}

	username := line[start:pos]
	usernameCopy := make([]byte, len(username))
	copy(usernameCopy, username)

	block.Advance(pos)

	return &mast.MentionNode{
		Username: usernameCopy,
	}
}
