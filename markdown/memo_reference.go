package markdown

import (
	"net/url"
	"strings"

	"github.com/usememos/memos/internal/identifier"
)

// memoReferencePathPrefix is the path a memo is addressed by in this instance, which
// doubles as the reference syntax: an inline Markdown link to it references that memo.
const memoReferencePathPrefix = "/memos/"

// ParseMemoReferenceURL reports whether a Markdown link destination references a memo
// in this instance, and returns that memo's UID.
//
// Only root-relative paths count. An absolute URL naming another host's /memos/ path
// is an ordinary link, and content is parsed without knowing the instance's own origin.
// A fragment is kept: linking to a heading inside a memo still references the memo.
func ParseMemoReferenceURL(raw string) (uid string, ok bool) {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.IsAbs() || parsed.Host != "" {
		return "", false
	}
	if !strings.HasPrefix(parsed.Path, memoReferencePathPrefix) {
		return "", false
	}
	// Percent-encoding cannot appear in a UID, so an encoded path is some other link.
	if parsed.RawQuery != "" || strings.Contains(parsed.EscapedPath(), "%") {
		return "", false
	}
	candidate := strings.TrimPrefix(parsed.Path, memoReferencePathPrefix)
	if !identifier.UIDMatcher.MatchString(candidate) {
		return "", false
	}
	return candidate, true
}

// BuildMemoReferenceURL renders the link destination that references a memo.
func BuildMemoReferenceURL(uid string) string {
	return memoReferencePathPrefix + uid
}
