package markdown

import (
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/text"
	"github.com/yuin/goldmark/util"
)

// maskInvalidLinkReferenceDefinitions hides reference definitions that
// Goldmark accepts with an unclosed parenthesis in a bare destination.
// CommonMark treats those lines as ordinary Markdown text.
func maskInvalidLinkReferenceDefinitions(root ast.Node, source []byte) []byte {
	var masked []byte
	_ = ast.Walk(root, func(node ast.Node, entering bool) (ast.WalkStatus, error) {
		definition, ok := node.(*ast.LinkReferenceDefinition)
		if !entering || !ok || !hasUnclosedParenthesis(definition.Destination) {
			return ast.WalkContinue, nil
		}

		colon, bare := linkReferenceDestination(source, definition)
		if !bare {
			return ast.WalkContinue, nil
		}
		if masked == nil {
			masked = append([]byte(nil), source...)
		}
		masked[colon] = ';'
		return ast.WalkContinue, nil
	})
	return masked
}

func hasUnclosedParenthesis(destination []byte) bool {
	depth := 0
	for i := 0; i < len(destination); i++ {
		switch destination[i] {
		case '\\':
			if i+1 < len(destination) && util.IsPunct(destination[i+1]) {
				i++
			}
		case '(':
			depth++
		case ')':
			depth--
		default:
			// Other destination bytes do not affect parenthesis balance.
		}
	}
	return depth > 0
}

// linkReferenceDestination returns the definition colon and whether its
// destination uses the bare form whose parentheses must balance.
func linkReferenceDestination(source []byte, definition *ast.LinkReferenceDefinition) (int, bool) {
	reader := text.NewBlockReader(source, definition.Lines())
	reader.SkipSpaces()
	if reader.Peek() != '[' {
		return 0, false
	}

	reader.Advance(1)
	closureOptions := text.FindClosureOptions{Nesting: false, Newline: true, Advance: true}
	if _, found := reader.FindClosure('[', ']', closureOptions); !found || reader.Peek() != ':' {
		return 0, false
	}

	_, position := reader.Position()
	colon := position.Start
	if colon < 0 || colon >= len(source) || source[colon] != ':' {
		return 0, false
	}

	reader.Advance(1)
	reader.SkipSpaces()
	return colon, reader.Peek() != '<'
}
