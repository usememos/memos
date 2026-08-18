package httpgetter

import (
	"bytes"
	"encoding/json"
	"mime"
	"net/url"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/pkg/errors"
	"golang.org/x/net/html"
)

const (
	maxTitleRunes        = 200
	maxDescriptionRunes  = 300
	minSemanticTextRunes = 40
	maxImageURLBytes     = 2048
)

type metadataSource struct {
	title       string
	description string
	image       string
}

type documentMetadata struct {
	openGraph metadataSource
	twitter   metadataSource
	jsonLD    metadataSource
	standard  metadataSource
	semantic  metadataSource
	baseHref  string
}

func extractDocumentMetadata(document *html.Node) (documentMetadata, string) {
	var sources documentMetadata
	var oEmbedEndpoint string
	var jsonLDScripts []string

	walkNodes(document, func(node *html.Node) {
		if node.Type != html.ElementNode {
			return
		}
		switch strings.ToLower(node.Data) {
		case "title":
			// Foreign-content titles (inline SVG/MathML accessibility labels)
			// are not the document title.
			if node.Namespace == "" {
				setIfEmpty(&sources.standard.title, nodeText(node))
			}
		case "base":
			setIfEmpty(&sources.baseHref, firstAttribute(node, "href"))
		case "meta":
			name := strings.ToLower(strings.TrimSpace(firstAttribute(node, "property", "name")))
			content := firstAttribute(node, "content")
			switch name {
			case "og:title":
				setIfEmpty(&sources.openGraph.title, content)
			case "og:description":
				setIfEmpty(&sources.openGraph.description, content)
			case "og:image", "og:image:url", "og:image:secure_url":
				setImageIfEmpty(&sources.openGraph.image, content)
			case "twitter:title":
				setIfEmpty(&sources.twitter.title, content)
			case "twitter:description":
				setIfEmpty(&sources.twitter.description, content)
			case "twitter:image", "twitter:image:src":
				setImageIfEmpty(&sources.twitter.image, content)
			case "description":
				setIfEmpty(&sources.standard.description, content)
			case "title", "name", "headline":
				setIfEmpty(&sources.standard.title, content)
			case "image":
				setImageIfEmpty(&sources.standard.image, content)
			default:
			}
		case "link":
			rels := strings.Fields(strings.ToLower(firstAttribute(node, "rel")))
			if containsString(rels, "image_src") {
				setImageIfEmpty(&sources.standard.image, firstAttribute(node, "href"))
			}
			if oEmbedEndpoint == "" && containsString(rels, "alternate") {
				mediaType := firstAttribute(node, "type")
				if isJSONOEmbedMediaType(mediaType) {
					oEmbedEndpoint = firstAttribute(node, "href")
				}
			}
		case "script":
			if isJSONLDMediaType(firstAttribute(node, "type")) {
				jsonLDScripts = append(jsonLDScripts, rawNodeText(node))
			}
		default:
		}
	})

	sources.jsonLD = extractJSONLDMetadata(jsonLDScripts)
	sources.semantic = extractSemanticMetadata(document)
	return sources, oEmbedEndpoint
}

func mergeMetadata(pageURL *url.URL, sources ...metadataSource) *HTMLMeta {
	meta := &HTMLMeta{}
	for _, source := range sources {
		setIfEmpty(&meta.Title, source.title)
		setIfEmpty(&meta.Description, source.description)
		if meta.Image == "" {
			meta.Image = resolveHTTPURL(pageURL, source.image)
		}
	}
	meta.Title = truncateText(normalizeWhitespace(meta.Title), maxTitleRunes)
	meta.Description = truncateText(normalizeWhitespace(meta.Description), maxDescriptionRunes)
	// A truncated URL would be broken, so oversized image URLs are dropped
	// rather than shortened.
	if len(meta.Image) > maxImageURLBytes {
		meta.Image = ""
	}
	return meta
}

func extractOEmbedMetadata(data []byte, baseURL *url.URL) (metadataSource, error) {
	var payload struct {
		Type         string `json:"type"`
		Title        string `json:"title"`
		Description  string `json:"description"`
		ThumbnailURL string `json:"thumbnail_url"`
		URL          string `json:"url"`
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	if err := decoder.Decode(&payload); err != nil {
		return metadataSource{}, errors.Wrap(err, "failed to decode oEmbed response")
	}
	image := resolveHTTPURL(baseURL, payload.ThumbnailURL)
	if image == "" && strings.EqualFold(payload.Type, "photo") {
		image = resolveHTTPURL(baseURL, payload.URL)
	}
	return metadataSource{
		title:       payload.Title,
		description: payload.Description,
		image:       image,
	}, nil
}

func extractJSONLDMetadata(scripts []string) metadataSource {
	var best metadataSource
	bestScore := -1
	for _, script := range scripts {
		var value any
		decoder := json.NewDecoder(strings.NewReader(script))
		if err := decoder.Decode(&value); err != nil {
			continue
		}
		walkJSONLD(value, func(object map[string]any) {
			candidate := metadataSource{
				title:       firstJSONString(object["headline"], object["name"]),
				description: firstJSONString(object["description"]),
				image:       jsonLDImage(object["image"]),
			}
			if candidate.image == "" {
				candidate.image = jsonLDImage(object["thumbnailUrl"])
			}
			if candidate == (metadataSource{}) {
				return
			}
			score := jsonLDTypeScore(object["@type"])
			if candidate.title != "" {
				score++
			}
			if candidate.description != "" {
				score++
			}
			if candidate.image != "" {
				score++
			}
			if score > bestScore {
				best = candidate
				bestScore = score
			}
		})
	}
	return best
}

func walkJSONLD(value any, visit func(map[string]any)) {
	switch typed := value.(type) {
	case []any:
		for _, item := range typed {
			walkJSONLD(item, visit)
		}
	case map[string]any:
		visit(typed)
		for _, nested := range typed {
			walkJSONLD(nested, visit)
		}
	default:
	}
}

func jsonLDTypeScore(value any) int {
	types := jsonLDStrings(value)
	for _, value := range types {
		switch strings.ToLower(value) {
		case "article", "newsarticle", "blogposting", "socialmediaposting", "product", "videoobject", "movie", "book", "event", "recipe":
			return 20
		case "creativework", "webpage", "profilepage", "aboutpage", "collectionpage":
			return 10
		case "breadcrumblist", "itemlist":
			return -10
		}
	}
	return 0
}

func jsonLDImage(value any) string {
	switch typed := value.(type) {
	case string:
		if isPotentialHTTPURL(typed) {
			return typed
		}
	case []any:
		for _, item := range typed {
			if image := jsonLDImage(item); image != "" {
				return image
			}
		}
	case map[string]any:
		// "@id" is deliberately excluded: it is a node reference (often the
		// page's own URL plus a fragment), not an image location.
		for _, candidate := range []any{typed["url"], typed["contentUrl"]} {
			if image := jsonLDImage(candidate); image != "" {
				return image
			}
		}
	default:
	}
	return ""
}

func firstJSONString(values ...any) string {
	for _, value := range values {
		for _, candidate := range jsonLDStrings(value) {
			if strings.TrimSpace(candidate) != "" {
				return candidate
			}
		}
	}
	return ""
}

func jsonLDStrings(value any) []string {
	switch typed := value.(type) {
	case string:
		return []string{typed}
	case []any:
		var result []string
		for _, item := range typed {
			result = append(result, jsonLDStrings(item)...)
		}
		return result
	}
	return nil
}

func extractSemanticMetadata(document *html.Node) metadataSource {
	root := firstElement(document, "main", "article")
	if root == nil {
		root = firstElement(document, "body")
	}
	if root == nil {
		return metadataSource{}
	}

	var source metadataSource
	walkNodes(root, func(node *html.Node) {
		if node.Type != html.ElementNode {
			return
		}
		switch strings.ToLower(node.Data) {
		case "h1":
			setIfEmpty(&source.title, nodeText(node))
		case "p":
			text := normalizeWhitespace(nodeText(node))
			if source.description == "" && utf8.RuneCountInString(text) >= minSemanticTextRunes {
				source.description = text
			}
		case "img":
			setImageIfEmpty(&source.image, firstAttribute(node, "src"))
		default:
		}
	})
	return source
}

func resolveHTTPURL(baseURL *url.URL, candidate string) string {
	candidate = strings.TrimSpace(candidate)
	if candidate == "" {
		return ""
	}
	parsed, err := url.Parse(candidate)
	if err != nil {
		return ""
	}
	if baseURL != nil {
		parsed = baseURL.ResolveReference(parsed)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return ""
	}
	if parsed.Hostname() == "" {
		return ""
	}
	return parsed.String()
}

func walkNodes(node *html.Node, visit func(*html.Node)) {
	if node == nil {
		return
	}
	visit(node)
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		walkNodes(child, visit)
	}
}

// firstElement prefers earlier names over document order: all matches for
// names[0] outrank any match for names[1].
func firstElement(node *html.Node, names ...string) *html.Node {
	for _, name := range names {
		var result *html.Node
		walkNodes(node, func(candidate *html.Node) {
			if result != nil || candidate.Type != html.ElementNode {
				return
			}
			if strings.EqualFold(candidate.Data, name) {
				result = candidate
			}
		})
		if result != nil {
			return result
		}
	}
	return nil
}

func firstAttribute(node *html.Node, names ...string) string {
	for _, name := range names {
		for _, attribute := range node.Attr {
			if strings.EqualFold(attribute.Key, name) {
				return attribute.Val
			}
		}
	}
	return ""
}

func rawNodeText(node *html.Node) string {
	var builder strings.Builder
	walkNodes(node, func(candidate *html.Node) {
		if candidate.Type == html.TextNode {
			builder.WriteString(candidate.Data)
		}
	})
	return builder.String()
}

func nodeText(node *html.Node) string {
	return normalizeWhitespace(rawNodeText(node))
}

func normalizeWhitespace(value string) string {
	return strings.Join(strings.FieldsFunc(value, unicode.IsSpace), " ")
}

func truncateText(value string, maximum int) string {
	runes := []rune(value)
	if len(runes) <= maximum {
		return value
	}
	return strings.TrimSpace(string(runes[:maximum-1])) + "…"
}

func setIfEmpty(target *string, value string) {
	if *target == "" && strings.TrimSpace(value) != "" {
		*target = value
	}
}

func setImageIfEmpty(target *string, value string) {
	if *target == "" && isPotentialHTTPURL(value) {
		*target = value
	}
}

func isPotentialHTTPURL(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	parsed, err := url.Parse(value)
	if err != nil {
		return false
	}
	if parsed.Scheme == "" {
		return !strings.HasPrefix(value, "//") || parsed.Hostname() != ""
	}
	return (parsed.Scheme == "http" || parsed.Scheme == "https") && parsed.Hostname() != ""
}

func containsString(values []string, expected string) bool {
	for _, value := range values {
		if value == expected {
			return true
		}
	}
	return false
}

func isJSONOEmbedMediaType(value string) bool {
	mediaType, _, err := mime.ParseMediaType(value)
	return err == nil && strings.EqualFold(mediaType, "application/json+oembed")
}

func isJSONLDMediaType(value string) bool {
	mediaType, _, err := mime.ParseMediaType(value)
	return err == nil && strings.EqualFold(mediaType, "application/ld+json")
}

// resolveDocumentBase applies the document's <base href>, falling back to the
// final response URL when the base is missing or not an absolute http(s) URL.
func resolveDocumentBase(pageURL *url.URL, baseHref string) *url.URL {
	baseHref = strings.TrimSpace(baseHref)
	if baseHref == "" {
		return pageURL
	}
	parsed, err := url.Parse(baseHref)
	if err != nil {
		return pageURL
	}
	resolved := pageURL.ResolveReference(parsed)
	if (resolved.Scheme != "http" && resolved.Scheme != "https") || resolved.Hostname() == "" {
		return pageURL
	}
	return resolved
}
