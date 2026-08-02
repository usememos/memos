package parser

import (
	"bytes"

	gast "github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
	"github.com/yuin/goldmark/util"

	mast "github.com/usememos/memos/internal/markdown/ast"
)

type inlineMathParser struct{}

// NewInlineMathParser creates a parser for exact dollar-run inline math.
func NewInlineMathParser() parser.InlineParser {
	return &inlineMathParser{}
}

func (*inlineMathParser) Trigger() []byte {
	return []byte{'$'}
}

func (*inlineMathParser) Parse(_ gast.Node, reader text.Reader, _ parser.Context) gast.Node {
	line, _ := reader.PeekLine()
	openingLength := dollarRunLength(line)
	if openingLength == 0 || hasUnescapedPrecedingDollar(reader) {
		return nil
	}

	savedLine, savedPosition := reader.Position()
	source := append([]byte(nil), line[:openingLength]...)
	reader.Advance(openingLength)

	for {
		line, _ = reader.PeekLine()
		if line == nil {
			reader.SetPosition(savedLine, savedPosition)
			return nil
		}

		for pos := 0; pos < len(line); {
			if line[pos] != '$' {
				pos++
				continue
			}
			closingLength := dollarRunLength(line[pos:])
			if closingLength == openingLength {
				end := pos + closingLength
				source = append(source, line[:end]...)
				reader.Advance(end)
				return &mast.InlineMathNode{Source: source}
			}
			pos += closingLength
		}

		source = append(source, line...)
		reader.AdvanceLine()
	}
}

// hasUnescapedPrecedingDollar prevents retrying within one dollar run while
// allowing a new run after an escaped dollar.
func hasUnescapedPrecedingDollar(reader text.Reader) bool {
	if reader.PrecendingCharacter() != '$' {
		return false
	}
	_, position := reader.Position()
	previous := position.Start - 1
	if previous < 0 || reader.Source()[previous] != '$' {
		return true
	}

	backslashes := 0
	for pos := previous - 1; pos >= 0 && reader.Source()[pos] == '\\'; pos-- {
		backslashes++
	}
	return backslashes%2 == 0
}

type blockMathParser struct{}

// NewBlockMathParser creates a parser for dollar-fenced flow math.
func NewBlockMathParser() parser.BlockParser {
	return &blockMathParser{}
}

func (*blockMathParser) Trigger() []byte {
	return []byte{'$'}
}

func (*blockMathParser) Open(_ gast.Node, reader text.Reader, context parser.Context) (gast.Node, parser.State) {
	line, _ := reader.PeekLine()
	pos := context.BlockOffset()
	if pos < 0 || pos >= len(line) {
		return nil, parser.NoChildren
	}

	fenceLength := dollarRunLength(line[pos:])
	if fenceLength < 2 || bytes.IndexByte(line[pos+fenceLength:], '$') >= 0 {
		return nil, parser.NoChildren
	}

	node := mast.NewBlockMathNode(line, fenceLength)
	reader.AdvanceToEOL()
	return node, parser.NoChildren
}

func (*blockMathParser) Continue(node gast.Node, reader text.Reader, _ parser.Context) parser.State {
	mathNode, ok := node.(*mast.BlockMathNode)
	if !ok {
		return parser.Close
	}

	line, _ := reader.PeekLine()
	width, pos := util.IndentWidth(line, reader.LineOffset())
	if width < 4 {
		fenceLength := dollarRunLength(line[pos:])
		if fenceLength >= mathNode.FenceLength() && util.IsBlank(line[pos+fenceLength:]) {
			mathNode.AppendSource(line)
			reader.AdvanceToEOL()
			return parser.Close
		}
	}

	mathNode.AppendSource(line)
	reader.AdvanceToEOL()
	return parser.Continue | parser.NoChildren
}

func (*blockMathParser) Close(gast.Node, text.Reader, parser.Context) {}

func (*blockMathParser) CanInterruptParagraph() bool {
	return true
}

func (*blockMathParser) CanAcceptIndentedLine() bool {
	return false
}

func dollarRunLength(source []byte) int {
	length := 0
	for length < len(source) && source[length] == '$' {
		length++
	}
	return length
}
