package markdown

import (
	"bytes"
	"strings"

	"github.com/yuin/goldmark"
	gast "github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	east "github.com/yuin/goldmark/extension/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"

	mast "github.com/usememos/memos/plugin/markdown/ast"
	"github.com/usememos/memos/plugin/markdown/extensions"
	"github.com/usememos/memos/plugin/markdown/renderer"
	storepb "github.com/usememos/memos/proto/gen/store"
)

// ExtractedData contains all metadata extracted from markdown in a single pass.
type ExtractedData struct {
	Tags     []string
	Property *storepb.MemoPayload_Property
}

// Service handles markdown metadata extraction.
// It uses goldmark to parse markdown and extract tags, properties, and snippets.
// HTML rendering is primarily done on frontend using markdown-it, but backend provides
// RenderHTML for RSS feeds and other server-side rendering needs.
type Service interface {
	// ExtractAll extracts tags, properties, and references in a single parse (most efficient)
	ExtractAll(content []byte) (*ExtractedData, error)

	// ExtractTags returns all #tags found in content
	ExtractTags(content []byte) ([]string, error)

	// ExtractProperties computes boolean properties
	ExtractProperties(content []byte) (*storepb.MemoPayload_Property, error)

	// RenderMarkdown renders goldmark AST back to markdown text
	RenderMarkdown(content []byte) (string, error)

	// RenderHTML renders markdown content to HTML
	RenderHTML(content []byte) (string, error)

	// GenerateSnippet creates plain text summary
	GenerateSnippet(content []byte, maxLength int) (string, error)

	// ValidateContent checks for syntax errors
	ValidateContent(content []byte) error

	// RenameTag renames all occurrences of oldTag to newTag in content
	RenameTag(content []byte, oldTag, newTag string) (string, error)
}

// service implements the Service interface.
type service struct {
	md goldmark.Markdown
}

// Option configures the markdown service.
type Option func(*config)

type config struct {
	enableTags bool
}

// WithTagExtension enables #tag parsing.
func WithTagExtension() Option {
	return func(c *config) {
		c.enableTags = true
	}
}

// NewService creates a new markdown service with the given options.
func NewService(opts ...Option) Service {
	cfg := &config{}
	for _, opt := range opts {
		opt(cfg)
	}

	exts := []goldmark.Extender{
		extension.GFM, // GitHub Flavored Markdown (tables, strikethrough, task lists, autolinks)
	}

	// Add custom extensions based on config
	if cfg.enableTags {
		exts = append(exts, extensions.TagExtension)
	}

	md := goldmark.New(
		goldmark.WithExtensions(exts...),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(), // Generate heading IDs
		),
	)

	return &service{
		md: md,
	}
}

// parse is an internal helper to parse content into AST.
func (s *service) parse(content []byte) (gast.Node, error) {
	reader := text.NewReader(content)
	doc := s.md.Parser().Parse(reader)
	return doc, nil
}

// ExtractTags returns all #tags found in content.
func (s *service) ExtractTags(content []byte) ([]string, error) {
	root, err := s.parse(content)
	if err != nil {
		return nil, err
	}

	var tags []string

	// Walk the AST to find tag nodes
	err = gast.Walk(root, func(n gast.Node, entering bool) (gast.WalkStatus, error) {
		if !entering {
			return gast.WalkContinue, nil
		}

		// Check for custom TagNode
		if tagNode, ok := n.(*mast.TagNode); ok {
			tags = append(tags, string(tagNode.Tag))
		}

		return gast.WalkContinue, nil
	})

	if err != nil {
		return nil, err
	}

	// Deduplicate tags while preserving original case
	return uniquePreserveCase(tags), nil
}

// ExtractProperties computes boolean properties about the content.
func (s *service) ExtractProperties(content []byte) (*storepb.MemoPayload_Property, error) {
	root, err := s.parse(content)
	if err != nil {
		return nil, err
	}

	prop := &storepb.MemoPayload_Property{}

	err = gast.Walk(root, func(n gast.Node, entering bool) (gast.WalkStatus, error) {
		if !entering {
			return gast.WalkContinue, nil
		}

		switch n.Kind() {
		case gast.KindLink:
			prop.HasLink = true

		case gast.KindCodeBlock, gast.KindFencedCodeBlock, gast.KindCodeSpan:
			prop.HasCode = true

		case east.KindTaskCheckBox:
			prop.HasTaskList = true
			if checkBox, ok := n.(*east.TaskCheckBox); ok {
				if !checkBox.IsChecked {
					prop.HasIncompleteTasks = true
				}
			}
		default:
			// No special handling for other node types
		}

		return gast.WalkContinue, nil
	})

	if err != nil {
		return nil, err
	}

	return prop, nil
}

// RenderMarkdown renders goldmark AST back to markdown text.
func (s *service) RenderMarkdown(content []byte) (string, error) {
	root, err := s.parse(content)
	if err != nil {
		return "", err
	}

	mdRenderer := renderer.NewMarkdownRenderer()
	return mdRenderer.Render(root, content), nil
}

// RenderHTML renders markdown content to HTML using goldmark's built-in HTML renderer.
func (s *service) RenderHTML(content []byte) (string, error) {
	var buf bytes.Buffer
	if err := s.md.Convert(content, &buf); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// GenerateSnippet creates a plain text summary from markdown content.
func (s *service) GenerateSnippet(content []byte, maxLength int) (string, error) {
	root, err := s.parse(content)
	if err != nil {
		return "", err
	}

	var buf strings.Builder
	var lastNodeWasBlock bool

	err = gast.Walk(root, func(n gast.Node, entering bool) (gast.WalkStatus, error) {
		if entering {
			// Skip code blocks and code spans entirely
			switch n.Kind() {
			case gast.KindCodeBlock, gast.KindFencedCodeBlock, gast.KindCodeSpan:
				return gast.WalkSkipChildren, nil
			default:
				// Continue walking for other node types
			}

			// Add space before block elements (except first)
			switch n.Kind() {
			case gast.KindParagraph, gast.KindHeading, gast.KindListItem:
				if buf.Len() > 0 && lastNodeWasBlock {
					buf.WriteByte(' ')
				}
			default:
				// No space needed for other node types
			}
		}

		if !entering {
			// Mark that we just exited a block element
			switch n.Kind() {
			case gast.KindParagraph, gast.KindHeading, gast.KindListItem:
				lastNodeWasBlock = true
			default:
				// Not a block element
			}
			return gast.WalkContinue, nil
		}

		lastNodeWasBlock = false

		// Only extract plain text nodes
		if textNode, ok := n.(*gast.Text); ok {
			segment := textNode.Segment
			buf.Write(segment.Value(content))

			// Add space if this is a soft line break
			if textNode.SoftLineBreak() {
				buf.WriteByte(' ')
			}
		}

		// Stop walking if we've exceeded double the max length
		// (we'll truncate precisely later)
		if buf.Len() > maxLength*2 {
			return gast.WalkStop, nil
		}

		return gast.WalkContinue, nil
	})

	if err != nil {
		return "", err
	}

	snippet := buf.String()

	// Truncate at word boundary if needed
	if len(snippet) > maxLength {
		snippet = truncateAtWord(snippet, maxLength)
	}

	return strings.TrimSpace(snippet), nil
}

// ValidateContent checks if the markdown content is valid.
func (s *service) ValidateContent(content []byte) error {
	// Try to parse the content
	_, err := s.parse(content)
	return err
}

// ExtractAll extracts tags, properties, and references in a single parse for efficiency.
func (s *service) ExtractAll(content []byte) (*ExtractedData, error) {
	root, err := s.parse(content)
	if err != nil {
		return nil, err
	}

	data := &ExtractedData{
		Tags:     []string{},
		Property: &storepb.MemoPayload_Property{},
	}

	// Single walk to collect all data
	err = gast.Walk(root, func(n gast.Node, entering bool) (gast.WalkStatus, error) {
		if !entering {
			return gast.WalkContinue, nil
		}

		// Extract tags
		if tagNode, ok := n.(*mast.TagNode); ok {
			data.Tags = append(data.Tags, string(tagNode.Tag))
		}

		// Extract properties based on node kind
		switch n.Kind() {
		case gast.KindLink:
			data.Property.HasLink = true

		case gast.KindCodeBlock, gast.KindFencedCodeBlock, gast.KindCodeSpan:
			data.Property.HasCode = true

		case east.KindTaskCheckBox:
			data.Property.HasTaskList = true
			if checkBox, ok := n.(*east.TaskCheckBox); ok {
				if !checkBox.IsChecked {
					data.Property.HasIncompleteTasks = true
				}
			}
		default:
			// No special handling for other node types
		}

		return gast.WalkContinue, nil
	})

	if err != nil {
		return nil, err
	}

	// Deduplicate tags while preserving original case
	data.Tags = uniquePreserveCase(data.Tags)

	return data, nil
}

// RenameTag renames all occurrences of oldTag to newTag in content.
func (s *service) RenameTag(content []byte, oldTag, newTag string) (string, error) {
	root, err := s.parse(content)
	if err != nil {
		return "", err
	}

	// Walk the AST to find and rename tag nodes
	err = gast.Walk(root, func(n gast.Node, entering bool) (gast.WalkStatus, error) {
		if !entering {
			return gast.WalkContinue, nil
		}

		// Check for custom TagNode and rename if it matches
		if tagNode, ok := n.(*mast.TagNode); ok {
			if string(tagNode.Tag) == oldTag {
				tagNode.Tag = []byte(newTag)
			}
		}

		return gast.WalkContinue, nil
	})

	if err != nil {
		return "", err
	}

	// Render back to markdown using the already-parsed AST
	mdRenderer := renderer.NewMarkdownRenderer()
	return mdRenderer.Render(root, content), nil
}

// uniquePreserveCase returns unique strings from input while preserving case.
func uniquePreserveCase(strs []string) []string {
	seen := make(map[string]struct{})
	var result []string

	for _, s := range strs {
		if _, exists := seen[s]; !exists {
			seen[s] = struct{}{}
			result = append(result, s)
		}
	}

	return result
}

// truncateAtWord truncates a string at the last word boundary before maxLength.
// maxLength is treated as a rune (character) count to properly handle UTF-8 multi-byte characters.
func truncateAtWord(s string, maxLength int) string {
	// Convert to runes to properly handle multi-byte UTF-8 characters
	runes := []rune(s)
	if len(runes) <= maxLength {
		return s
	}

	// Truncate to max length (by character count, not byte count)
	truncated := string(runes[:maxLength])

	// Find last space to avoid cutting in the middle of a word
	lastSpace := strings.LastIndexAny(truncated, " \t\n\r")
	if lastSpace > 0 {
		truncated = truncated[:lastSpace]
	}

	return truncated + " ..."
}
