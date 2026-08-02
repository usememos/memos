package parser

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	mast "github.com/usememos/memos/internal/markdown/ast"
)

func TestFindTagMatches(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectedTag string
		shouldParse bool
	}{
		{
			name:        "basic tag",
			input:       "#tag",
			expectedTag: "tag",
			shouldParse: true,
		},
		{
			name:        "tag with hyphen",
			input:       "#work-notes",
			expectedTag: "work-notes",
			shouldParse: true,
		},
		{
			name:        "tag with ampersand",
			input:       "#science&tech",
			expectedTag: "science&tech",
			shouldParse: true,
		},
		{
			name:        "tag with underscore",
			input:       "#2024_plans",
			expectedTag: "2024_plans",
			shouldParse: true,
		},
		{
			name:        "numeric tag",
			input:       "#123",
			expectedTag: "123",
			shouldParse: true,
		},
		{
			name:        "tag followed by space",
			input:       "#tag ",
			expectedTag: "tag",
			shouldParse: true,
		},
		{
			name:        "tag followed by punctuation",
			input:       "#tag.",
			expectedTag: "tag",
			shouldParse: true,
		},
		{
			name:        "tag in sentence",
			input:       "#important task",
			expectedTag: "important",
			shouldParse: true,
		},
		{
			name:        "heading (##)",
			input:       "## Heading",
			expectedTag: "",
			shouldParse: false,
		},
		{
			name:        "space after hash",
			input:       "# heading",
			expectedTag: "",
			shouldParse: false,
		},
		{
			name:        "lone hash",
			input:       "#",
			expectedTag: "",
			shouldParse: false,
		},
		{
			name:        "hash with space",
			input:       "# ",
			expectedTag: "",
			shouldParse: false,
		},
		{
			name:        "special characters",
			input:       "#tag@special",
			expectedTag: "tag",
			shouldParse: true,
		},
		{
			name:        "mixed case",
			input:       "#WorkNotes",
			expectedTag: "WorkNotes",
			shouldParse: true,
		},
		{
			name:        "hierarchical tag with slash",
			input:       "#tag1/subtag",
			expectedTag: "tag1/subtag",
			shouldParse: true,
		},
		{
			name:        "hierarchical tag with multiple levels",
			input:       "#tag1/subtag/subtag2",
			expectedTag: "tag1/subtag/subtag2",
			shouldParse: true,
		},
		{
			name:        "hierarchical tag followed by space",
			input:       "#work/notes ",
			expectedTag: "work/notes",
			shouldParse: true,
		},
		{
			name:        "hierarchical tag followed by punctuation",
			input:       "#project/2024.",
			expectedTag: "project/2024",
			shouldParse: true,
		},
		{
			name:        "hierarchical tag with numbers and dashes",
			input:       "#work-log/2024/q1",
			expectedTag: "work-log/2024/q1",
			shouldParse: true,
		},
		{
			name:        "Chinese characters",
			input:       "#测试",
			expectedTag: "测试",
			shouldParse: true,
		},
		{
			name:        "Chinese tag followed by space",
			input:       "#测试 some text",
			expectedTag: "测试",
			shouldParse: true,
		},
		{
			name:        "Chinese tag followed by punctuation",
			input:       "#测试。",
			expectedTag: "测试",
			shouldParse: true,
		},
		{
			name:        "mixed Chinese and ASCII",
			input:       "#测试test123",
			expectedTag: "测试test123",
			shouldParse: true,
		},
		{
			name:        "Japanese characters",
			input:       "#テスト",
			expectedTag: "テスト",
			shouldParse: true,
		},
		{
			name:        "Korean characters",
			input:       "#테스트",
			expectedTag: "테스트",
			shouldParse: true,
		},
		{
			name:        "emoji",
			input:       "#test🚀",
			expectedTag: "test🚀",
			shouldParse: true,
		},
		{
			name:        "emoji with VS16",
			input:       "#test👁️", // Eye + VS16
			expectedTag: "test👁️",
			shouldParse: true,
		},
		{
			name:        "emoji with ZWJ sequence",
			input:       "#family👨‍👩‍👧‍👦", // Family ZWJ sequence
			expectedTag: "family👨‍👩‍👧‍👦",
			shouldParse: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matches := FindTagMatches([]byte(tt.input))
			if tt.shouldParse {
				require.NotEmpty(t, matches, "Expected tag to be parsed")
				assert.Equal(t, tt.expectedTag, string(matches[0].Value))
			} else {
				assert.Empty(t, matches, "Expected tag NOT to be parsed")
			}
		})
	}
}

func TestFindTagMatchesMultipleTags(t *testing.T) {
	matches := FindTagMatches([]byte("#tag1 #tag2"))
	require.Len(t, matches, 2)
	assert.Equal(t, "tag1", string(matches[0].Value))
	assert.Equal(t, "tag2", string(matches[1].Value))
}

func TestFindTagMatchesMemosTagV1(t *testing.T) {
	tests := []struct {
		name           string
		input          string
		expectedTag    string
		expectedSource string
		expectedRest   string
		shouldParse    bool
	}{
		{name: "plus extension", input: "#C++", expectedTag: "C++", expectedSource: "#C++", shouldParse: true},
		{name: "visible extensions form segment", input: "#---", expectedTag: "---", expectedSource: "#---", shouldParse: true},
		{name: "ampersands form segment", input: "#&&", expectedTag: "&&", expectedSource: "#&&", shouldParse: true},
		{name: "Unicode 16 XID character under Unicode 17 profile", input: "#\u1c89", expectedTag: "\u1c89", expectedSource: "#\u1c89", shouldParse: true},
		{name: "middle dot XID continue", input: "#l·l", expectedTag: "l·l", expectedSource: "#l·l", shouldParse: true},
		{name: "connector punctuation XID continue", input: "#foo‿bar", expectedTag: "foo‿bar", expectedSource: "#foo‿bar", shouldParse: true},
		{name: "ASCII apostrophe joiner", input: "#tag's", expectedTag: "tag's", expectedSource: "#tag's", shouldParse: true},
		{name: "ASCII apostrophe in Ukrainian", input: "#сім'я", expectedTag: "сім'я", expectedSource: "#сім'я", shouldParse: true},
		{name: "right curly apostrophe joiner", input: "#O’Brien", expectedTag: "O’Brien", expectedSource: "#O’Brien", shouldParse: true},
		{name: "modifier letter apostrophe stays XID", input: "#OʼBrien", expectedTag: "OʼBrien", expectedSource: "#OʼBrien", shouldParse: true},
		{name: "combining mark before apostrophe", input: "#cafe\u0301's", expectedTag: "cafe\u0301's", expectedSource: "#cafe\u0301's", shouldParse: true},
		{name: "apostrophe cannot start", input: "#'tag", shouldParse: false},
		{name: "apostrophe cannot end", input: "#users'", expectedTag: "users", expectedSource: "#users", expectedRest: "'", shouldParse: true},
		{name: "apostrophe cannot repeat", input: "#rock''roll", expectedTag: "rock", expectedSource: "#rock", expectedRest: "''roll", shouldParse: true},
		{name: "left curly quote terminates", input: "#O‘Brien", expectedTag: "O", expectedSource: "#O", expectedRest: "‘Brien", shouldParse: true},
		{name: "apostrophe does not adjoin extension", input: "#foo-'bar", expectedTag: "foo-", expectedSource: "#foo-", expectedRest: "'bar", shouldParse: true},
		{name: "apostrophe does not adjoin fully qualified emoji", input: "#foo'1️⃣", expectedTag: "foo", expectedSource: "#foo", expectedRest: "'1️⃣", shouldParse: true},
		{name: "apostrophe does not join across ignored code point", input: "#A\u200d'B", expectedTag: "A", expectedSource: "#A\u200d", expectedRest: "'B", shouldParse: true},
		{name: "currency terminates", input: "#price€", expectedTag: "price", expectedSource: "#price", expectedRest: "€", shouldParse: true},
		{name: "currency cannot start", input: "#€budget", shouldParse: false},
		{name: "other number terminates", input: "#v²", expectedTag: "v", expectedSource: "#v", expectedRest: "²", shouldParse: true},
		{name: "leading ZWJ omitted", input: "#\u200dfoo", expectedTag: "foo", expectedSource: "#\u200dfoo", shouldParse: true},
		{name: "medial ZWJ omitted", input: "#A\u200dB", expectedTag: "AB", expectedSource: "#A\u200dB", shouldParse: true},
		{name: "medial ZWNJ omitted", input: "#A\u200cB", expectedTag: "AB", expectedSource: "#A\u200cB", shouldParse: true},
		{name: "variation selector omitted outside emoji", input: "#A\ufe0fB", expectedTag: "AB", expectedSource: "#A\ufe0fB", shouldParse: true},
		{name: "ignored code points alone", input: "#\u200d\u200c", shouldParse: false},
		{name: "leading combining mark omitted", input: "#\u0301foo", expectedTag: "foo", expectedSource: "#\u0301foo", shouldParse: true},
		{name: "leading combining mark alone", input: "#\u0301", shouldParse: false},
		{name: "combining mark preserved after starter", input: "#cafe\u0301", expectedTag: "cafe\u0301", expectedSource: "#cafe\u0301", shouldParse: true},
		{name: "ignored prefix restarts after slash", input: "#foo/\u0301bar", expectedTag: "foo/bar", expectedSource: "#foo/\u0301bar", shouldParse: true},
		{name: "trailing slash", input: "#book/", expectedTag: "book", expectedSource: "#book", expectedRest: "/", shouldParse: true},
		{name: "leading slash", input: "#/book", shouldParse: false},
		{name: "repeated slash", input: "#book//fiction", expectedTag: "book", expectedSource: "#book", expectedRest: "//fiction", shouldParse: true},
		{name: "valid hierarchy before trailing slash", input: "#book/fiction/", expectedTag: "book/fiction", expectedSource: "#book/fiction", expectedRest: "/", shouldParse: true},
		{name: "fully qualified keycap", input: "#*️⃣", expectedTag: "*️⃣", expectedSource: "#*️⃣", shouldParse: true},
		{name: "fully qualified emoji", input: "#‼️", expectedTag: "‼️", expectedSource: "#‼️", shouldParse: true},
		{name: "Emoji 17 sequence", input: "#🫯", expectedTag: "🫯", expectedSource: "#🫯", shouldParse: true},
		{name: "bare text presentation symbol", input: "#♥", shouldParse: false},
		{name: "fully qualified heart", input: "#♥️", expectedTag: "♥️", expectedSource: "#♥️", shouldParse: true},
		{name: "standalone emoji component", input: "#🏻", shouldParse: false},
		{name: "number sign keycap is not introducer", input: "#️⃣", shouldParse: false},
		{name: "fullwidth number sign is not introducer", input: "＃tag", shouldParse: false},
		{name: "small number sign is not introducer", input: "﹟tag", shouldParse: false},
		{name: "keycap as identifier", input: "##️⃣", expectedTag: "#️⃣", expectedSource: "##️⃣", shouldParse: true},
		{name: "keycap continues identifier", input: "#first#️⃣", expectedTag: "first#️⃣", expectedSource: "#first#️⃣", shouldParse: true},
		{name: "character reference boundary", input: "#R&amp;D", expectedTag: "R", expectedSource: "#R", expectedRest: "&amp;D", shouldParse: true},
		{name: "literal ampersand", input: "#R&D", expectedTag: "R&D", expectedSource: "#R&D", shouldParse: true},
		{
			name:           "no tag length limit",
			input:          "#" + strings.Repeat("a", 101),
			expectedTag:    strings.Repeat("a", 101),
			expectedSource: "#" + strings.Repeat("a", 101),
			shouldParse:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matches := FindTagMatches([]byte(tt.input))
			if !tt.shouldParse {
				assert.Empty(t, matches)
				return
			}

			require.NotEmpty(t, matches)
			match := matches[0]
			assert.Equal(t, tt.expectedTag, string(match.Value))
			assert.Equal(t, tt.expectedSource, tt.input[match.Start:match.End])
			assert.Equal(t, tt.expectedRest, tt.input[match.End:])
		})
	}
}

func TestFindTagMatchesRejectsNumericCharacterReference(t *testing.T) {
	for _, input := range []string{"&#35;tag", "&#x23;tag"} {
		t.Run(input, func(t *testing.T) {
			assert.Empty(t, FindTagMatches([]byte(input)))
		})
	}
}

func TestTagNode_Kind(t *testing.T) {
	node := &mast.TagNode{
		Tag: []byte("test"),
	}

	assert.Equal(t, mast.KindTag, node.Kind())
}

func TestTagNode_Dump(t *testing.T) {
	node := &mast.TagNode{
		Tag: []byte("test"),
	}

	// Should not panic
	assert.NotPanics(t, func() {
		node.Dump([]byte("#test"), 0)
	})
}
