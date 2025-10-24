package parser

import (
	"bytes"

	gast "github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"

	mast "github.com/usememos/memos/plugin/markdown/ast"
)

type wikilinkParser struct{}

// NewWikilinkParser creates a new inline parser for [[...]] wikilink syntax
func NewWikilinkParser() parser.InlineParser {
	return &wikilinkParser{}
}

// Trigger returns the characters that trigger this parser.
func (*wikilinkParser) Trigger() []byte {
	return []byte{'['}
}

// Parse parses [[target]] or [[target?params]] wikilink syntax.
func (*wikilinkParser) Parse(parent gast.Node, block text.Reader, pc parser.Context) gast.Node {
	line, _ := block.PeekLine()

	// Must start with [[
	if len(line) < 2 || line[0] != '[' || line[1] != '[' {
		return nil
	}

	// Find closing ]]
	closePos := findClosingBrackets(line[2:])
	if closePos == -1 {
		return nil
	}

	// Extract content between [[ and ]]
	// closePos is relative to line[2:], so actual position is closePos + 2
	contentStart := 2
	contentEnd := contentStart + closePos
	content := line[contentStart:contentEnd]

	// Empty content is not allowed
	if len(bytes.TrimSpace(content)) == 0 {
		return nil
	}

	// Parse target and parameters
	target, params := parseTargetAndParams(content)

	// Advance reader position
	// +2 for [[, +len(content), +2 for ]]
	block.Advance(contentEnd + 2)

	// Create AST node
	node := &mast.WikilinkNode{
		Target: target,
		Params: params,
	}

	return node
}

// findClosingBrackets finds the position of ]] in the byte slice
// Returns -1 if not found
func findClosingBrackets(data []byte) int {
	for i := 0; i < len(data)-1; i++ {
		if data[i] == ']' && data[i+1] == ']' {
			return i
		}
	}
	return -1
}

// parseTargetAndParams splits content on ? to extract target and parameters
func parseTargetAndParams(content []byte) (target []byte, params []byte) {
	// Find ? separator
	idx := bytes.IndexByte(content, '?')

	if idx == -1 {
		// No parameters
		target = bytes.TrimSpace(content)
		return target, nil
	}

	// Split on ?
	target = bytes.TrimSpace(content[:idx])
	params = content[idx+1:] // Keep params as-is (don't trim, might have meaningful spaces)

	// Make copies to avoid issues with slice sharing
	targetCopy := make([]byte, len(target))
	copy(targetCopy, target)

	var paramsCopy []byte
	if len(params) > 0 {
		paramsCopy = make([]byte, len(params))
		copy(paramsCopy, params)
	}

	return targetCopy, paramsCopy
}
