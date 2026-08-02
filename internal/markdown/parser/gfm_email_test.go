package parser

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func emailMatch(start, end int, address string) GFMEmailMatch {
	return GFMEmailMatch{Start: start, End: end, Address: []byte(address)}
}

func TestFindGFMEmailMatches(t *testing.T) {
	tests := []struct {
		name     string
		source   string
		expected []GFMEmailMatch
	}{
		{name: "basic", source: "mail@example.com", expected: []GFMEmailMatch{emailMatch(0, 16, "mail@example.com")}},
		{name: "slash starts a new local part", source: "#foo/bar_baz@example.com", expected: []GFMEmailMatch{emailMatch(5, 24, "bar_baz@example.com")}},
		{name: "punctuation starts a new local part", source: "#foo!bar@example.com", expected: []GFMEmailMatch{emailMatch(5, 20, "bar@example.com")}},
		{name: "hash starts a text-node email", source: "#foo@example.com", expected: []GFMEmailMatch{emailMatch(1, 16, "foo@example.com")}},
		{name: "Unicode starts a new local part", source: "#中foo@example.com", expected: []GFMEmailMatch{emailMatch(4, 19, "foo@example.com")}},
		{name: "emoji starts a new local part", source: "😀foo@example.com", expected: []GFMEmailMatch{emailMatch(4, 19, "foo@example.com")}},
		{name: "trailing dot excluded", source: "mail@example.com.", expected: []GFMEmailMatch{emailMatch(0, 16, "mail@example.com")}},
		{name: "invalid domain suffix", source: "mail@example.com_", expected: nil},
		{name: "multiple", source: "a@b.co c@d.io", expected: []GFMEmailMatch{emailMatch(0, 6, "a@b.co"), emailMatch(7, 13, "c@d.io")}},
		{name: "first email wins", source: "foo@bar.com@baz.example", expected: []GFMEmailMatch{emailMatch(0, 11, "foo@bar.com")}},
		{
			name:     "adjacent emails do not overlap",
			source:   "foo@bar.com+abc@def.com",
			expected: []GFMEmailMatch{emailMatch(0, 11, "foo@bar.com"), emailMatch(11, 23, "+abc@def.com")},
		},
		{name: "escaped local plus", source: `#foo\+bar@example.com`, expected: []GFMEmailMatch{emailMatch(1, 21, "foo+bar@example.com")}},
		{name: "escaped local underscore", source: `#next\_item@example.com`, expected: []GFMEmailMatch{emailMatch(1, 23, "next_item@example.com")}},
		{name: "escaped at and domain dot", source: `#foo\@example\.com`, expected: []GFMEmailMatch{emailMatch(1, 18, "foo@example.com")}},
		{name: "numeric dot reference", source: `#foo&#46;bar@example.com`, expected: []GFMEmailMatch{emailMatch(1, 24, "foo.bar@example.com")}},
		{name: "named dot reference", source: `#foo&period;bar@example.com`, expected: []GFMEmailMatch{emailMatch(1, 27, "foo.bar@example.com")}},
		{name: "numeric at reference", source: `#foo&#64;example.com`, expected: []GFMEmailMatch{emailMatch(1, 20, "foo@example.com")}},
		{name: "unknown reference stays literal", source: `#foo&bogus;bar@example.com`, expected: []GFMEmailMatch{emailMatch(11, 26, "bar@example.com")}},
		{name: "allowed delimiter", source: "(mail@example.com", expected: []GFMEmailMatch{emailMatch(1, 17, "mail@example.com")}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, FindGFMEmailMatches([]byte(test.source)))
		})
	}
}

func TestMatchGFMEmailAtPreservesEscapedSourceRange(t *testing.T) {
	source := []byte("first@example.com\n#foo\\+bar@example.com")
	lowerBound := bytes.IndexByte(source, '\n') + 1
	at := bytes.LastIndexByte(source, '@')
	start, end, ok := MatchGFMEmailAt(source, at, lowerBound, len(source))
	require.True(t, ok)
	assert.Equal(t, lowerBound+1, start)
	assert.Equal(t, len(source), end)
	assert.Equal(t, `foo\+bar@example.com`, string(source[start:end]))
}
