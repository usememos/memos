package extensions

import (
	"bytes"
	"regexp"
	"unicode"
	"unicode/utf8"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	goldmarkextension "github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
	"github.com/yuin/goldmark/util"

	mast "github.com/usememos/memos/internal/markdown/ast"
	mparser "github.com/usememos/memos/internal/markdown/parser"
)

const gfmDomainPattern = `(?:[\p{L}\p{N}_-]+\.)*[\p{L}\p{N}-]+\.[\p{L}\p{N}-]+`

var (
	gfmURLPattern = regexp.MustCompile(`^https?://` + gfmDomainPattern + `[^<\x09-\x0d\p{Z}]*`)
	gfmWWWPattern = regexp.MustCompile(`^www\.` + gfmDomainPattern + `[^<\x09-\x0d\p{Z}]*`)
	// Extended emails are resolved after emphasis instead of by the linkify parser.
	gfmNoEmail = regexp.MustCompile(`a^`)
)

type gfmLinkify struct{}

// NewGFMLinkify returns a linkifier configured for written GFM 0.29.
func NewGFMLinkify() goldmark.Extender {
	return &gfmLinkify{}
}

func (*gfmLinkify) Extend(markdown goldmark.Markdown) {
	markdown.Parser().AddOptions(
		parser.WithInlineParsers(util.Prioritized(newGFMLinkifyParser(), 999)),
		parser.WithASTTransformers(
			util.Prioritized(&gfmLinkifyASTTransformer{}, 900),
			util.Prioritized(&gfmEmailASTTransformer{}, 950),
		),
	)
}

func newGFMLinkifyParser() parser.InlineParser {
	return goldmarkextension.NewLinkifyParser(
		goldmarkextension.WithLinkifyAllowedProtocols([]string{"http:", "https:"}),
		goldmarkextension.WithLinkifyURLRegexp(gfmURLPattern),
		goldmarkextension.WithLinkifyWWWRegexp(gfmWWWPattern),
		// Extended emails are resolved after emphasis delimiters so unmatched
		// underscores are consolidated into their surrounding text node first.
		goldmarkextension.WithLinkifyEmailRegexp(gfmNoEmail),
	)
}

type gfmLinkifyASTTransformer struct{}

func (*gfmLinkifyASTTransformer) Transform(document *ast.Document, reader text.Reader, _ parser.Context) {
	var invalid []*ast.AutoLink
	_ = ast.Walk(document, func(node ast.Node, entering bool) (ast.WalkStatus, error) {
		link, ok := node.(*ast.AutoLink)
		if !entering || !ok || link.AutoLinkType != ast.AutoLinkURL {
			return ast.WalkContinue, nil
		}
		label := link.Label(reader.Source())
		start, found := autoLinkLabelStart(link, reader.Source(), label)
		if !found || isAngleAutoLink(reader.Source(), start, len(label)) {
			return ast.WalkContinue, nil
		}
		if !hasValidGFMDomain(label) {
			invalid = append(invalid, link)
		}
		return ast.WalkContinue, nil
	})

	for _, link := range invalid {
		parent := link.Parent()
		if parent == nil {
			continue
		}
		label := link.Label(reader.Source())
		start, found := autoLinkLabelStart(link, reader.Source(), label)
		if !found {
			continue
		}
		parent.ReplaceChild(parent, link, ast.NewTextSegment(text.NewSegment(start, start+len(label))))
	}

	replaceInitialBOMURL(document, reader.Source())
	replaceUnparsedGFMURLs(document, reader.Source())
}

type inlineNodeMatch struct {
	start int
	end   int
	node  ast.Node
}

func eligibleLiteralTextNodes(document *ast.Document) []*ast.Text {
	var nodes []*ast.Text
	_ = ast.Walk(document, func(node ast.Node, entering bool) (ast.WalkStatus, error) {
		textNode, ok := node.(*ast.Text)
		if entering && ok && isEligibleLiteralText(textNode) {
			nodes = append(nodes, textNode)
		}
		return ast.WalkContinue, nil
	})
	return nodes
}

func replaceInitialBOMURL(document *ast.Document, source []byte) {
	const bomLength = len("\uFEFF")
	if !bytes.HasPrefix(source, []byte("\uFEFF")) {
		return
	}

	linkParser := newGFMLinkifyParser()
	for _, textNode := range eligibleLiteralTextNodes(document) {
		segment := textNode.Segment
		if segment.Start > bomLength || segment.Stop <= bomLength || textNode.Parent() == nil {
			continue
		}

		urlReader := text.NewReader(source[:segment.Stop])
		urlReader.Advance(bomLength)
		link, ok := linkParser.Parse(textNode.Parent(), urlReader, parser.NewContext()).(*ast.AutoLink)
		if !ok || link.AutoLinkType != ast.AutoLinkURL {
			return
		}
		label := link.Label(source)
		if !hasValidGFMDomain(label) {
			return
		}
		end := bomLength + len(label)
		link.SetPos(bomLength)
		replaceInlineMatches(textNode, []inlineNodeMatch{{start: bomLength, end: end, node: link}})
		return
	}
}

func replaceUnparsedGFMURLs(document *ast.Document, source []byte) {
	linkParser := newGFMLinkifyParser()
	textNodes := eligibleLiteralTextNodes(document)
	mergeAdjacentLiteralText(textNodes, source)
	for _, textNode := range textNodes {
		if textNode.Parent() == nil {
			continue
		}

		segment := textNode.Segment
		var matches []inlineNodeMatch
		for offset := segment.Start; offset < segment.Stop; offset++ {
			if !hasWrittenGFMURLBoundary(source, offset) {
				continue
			}

			urlReader := text.NewReader(source[:segment.Stop])
			urlReader.Advance(offset)
			link, ok := linkParser.Parse(textNode.Parent(), urlReader, parser.NewContext()).(*ast.AutoLink)
			if !ok || link.AutoLinkType != ast.AutoLinkURL {
				continue
			}
			label := link.Label(source)
			if len(label) == 0 || offset+len(label) > segment.Stop ||
				!bytes.HasPrefix(source[offset:segment.Stop], label) || !hasValidGFMDomain(label) {
				continue
			}

			start := offset
			end := start + len(label)
			link.SetPos(start)
			matches = append(matches, inlineNodeMatch{start: start, end: end, node: link})
			offset = end - 1
		}
		replaceInlineMatches(textNode, matches)
	}
}

func hasWrittenGFMURLBoundary(source []byte, offset int) bool {
	if offset == 0 {
		return true
	}
	previous := source[offset-1]
	return previous == ' ' || previous >= '\t' && previous <= '\r' ||
		previous == '*' || previous == '_' || previous == '~' || previous == '('
}

func autoLinkLabelStart(link *ast.AutoLink, source, label []byte) (int, bool) {
	start := link.Pos()
	if start >= 0 && start <= len(source)-len(label) && bytes.HasPrefix(source[start:], label) {
		return start, true
	}
	// Goldmark gives a written link triggered by preceding punctuation that
	// punctuation's position, although it is not part of the label.
	start++
	if start >= 0 && start <= len(source)-len(label) && bytes.HasPrefix(source[start:], label) {
		return start, true
	}
	return 0, false
}

func isAngleAutoLink(source []byte, labelStart, labelLength int) bool {
	return labelStart > 0 && labelStart+labelLength < len(source) &&
		source[labelStart-1] == '<' && source[labelStart+labelLength] == '>'
}

func hasValidGFMDomain(label []byte) bool {
	domainStart := 0
	switch {
	case bytes.HasPrefix(label, []byte("http://")):
		domainStart = len("http://")
	case bytes.HasPrefix(label, []byte("https://")):
		domainStart = len("https://")
	case bytes.HasPrefix(label, []byte("www.")):
		domainStart = len("www.")
	default:
		return false
	}

	domainEnd := domainStart
	for domainEnd < len(label) {
		r, size := utf8.DecodeRune(label[domainEnd:])
		if (r == utf8.RuneError && size == 1) || !isGFMDomainRune(r) {
			break
		}
		domainEnd += size
	}
	segments := bytes.Split(label[domainStart:domainEnd], []byte{'.'})
	if len(segments) < 2 {
		return false
	}
	return !bytes.ContainsRune(segments[len(segments)-2], '_') && !bytes.ContainsRune(segments[len(segments)-1], '_')
}

func isGFMDomainRune(value rune) bool {
	return unicode.IsLetter(value) || unicode.IsNumber(value) || value == '_' || value == '-' || value == '.'
}

type gfmEmailASTTransformer struct{}

func (*gfmEmailASTTransformer) Transform(document *ast.Document, reader text.Reader, _ parser.Context) {
	source := reader.Source()
	textNodes := eligibleLiteralTextNodes(document)
	mergeAdjacentLiteralText(textNodes, source)
	for _, textNode := range textNodes {
		if textNode.Parent() != nil {
			replaceGFMEmailsInText(textNode, source)
		}
	}
}

func replaceGFMEmailsInText(textNode *ast.Text, source []byte) {
	segment := textNode.Segment
	emailMatches := mparser.FindGFMEmailMatches(source[segment.Start:segment.Stop])
	matches := make([]inlineNodeMatch, 0, len(emailMatches))
	for _, match := range emailMatches {
		start := segment.Start + match.Start
		end := segment.Start + match.End
		emailNode := &mast.GFMEmailNode{
			Source:  append([]byte(nil), source[start:end]...),
			Address: append([]byte(nil), match.Address...),
		}
		emailNode.SetPos(start)
		matches = append(matches, inlineNodeMatch{
			start: start,
			end:   end,
			node:  emailNode,
		})
	}
	replaceInlineMatches(textNode, matches)
}

func replaceInlineMatches(textNode *ast.Text, matches []inlineNodeMatch) {
	if len(matches) == 0 {
		return
	}
	segment := textNode.Segment
	parent := textNode.Parent()
	cursor := segment.Start
	padding := segment.Padding
	for _, match := range matches {
		if match.start > cursor || padding > 0 {
			insertSplitTextBefore(parent, textNode, textNode, text.NewSegmentPadding(cursor, match.start, padding), false)
		}
		parent.InsertBefore(parent, textNode, match.node)
		cursor = match.end
		padding = 0
	}

	if cursor < segment.Stop || textNode.SoftLineBreak() || textNode.HardLineBreak() {
		insertSplitTextBefore(parent, textNode, textNode, text.NewSegment(cursor, segment.Stop), true)
	}
	parent.RemoveChild(parent, textNode)
}
