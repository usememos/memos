package markdown

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/base"
)

func TestNewService(t *testing.T) {
	svc := NewService()
	assert.NotNil(t, svc)
}

func TestValidateContent(t *testing.T) {
	svc := NewService()

	tests := []struct {
		name    string
		content string
		wantErr bool
	}{
		{
			name:    "valid markdown",
			content: "# Hello\n\nThis is **bold** text.",
			wantErr: false,
		},
		{
			name:    "empty content",
			content: "",
			wantErr: false,
		},
		{
			name:    "complex markdown",
			content: "# Title\n\n- List item 1\n- List item 2\n\n```go\ncode block\n```",
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := svc.ValidateContent([]byte(tt.content))
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestGenerateSnippet(t *testing.T) {
	svc := NewService()

	tests := []struct {
		name      string
		content   string
		maxLength int
		expected  string
	}{
		{
			name:      "simple text",
			content:   "Hello world",
			maxLength: 100,
			expected:  "Hello world",
		},
		{
			name:      "text with formatting",
			content:   "This is **bold** and *italic* text.",
			maxLength: 100,
			expected:  "This is bold and italic text.",
		},
		{
			name:      "truncate long text",
			content:   "This is a very long piece of text that should be truncated at a word boundary.",
			maxLength: 30,
			expected:  "This is a very long piece of ...",
		},
		{
			name:      "heading and paragraph",
			content:   "# My Title\n\nThis is the first paragraph.",
			maxLength: 100,
			expected:  "My Title This is the first paragraph.",
		},
		{
			name:      "code block removed",
			content:   "Text before\n\n```go\ncode\n```\n\nText after",
			maxLength: 100,
			expected:  "Text before Text after",
		},
		{
			name:      "list items",
			content:   "- Item 1\n- Item 2\n- Item 3",
			maxLength: 100,
			expected:  "Item 1 Item 2 Item 3",
		},
		{
			name:      "inline code preserved",
			content:   "`console.log('hello')`",
			maxLength: 100,
			expected:  "console.log('hello')",
		},
		{
			name:      "text with inline code",
			content:   "Use `fmt.Println` to print output.",
			maxLength: 100,
			expected:  "Use fmt.Println to print output.",
		},
		{
			name:      "image alt text",
			content:   "![alt text](https://example.com/img.png)",
			maxLength: 100,
			expected:  "alt text",
		},
		{
			name:      "strikethrough text",
			content:   "~~deleted text~~",
			maxLength: 100,
			expected:  "deleted text",
		},
		{
			name:      "blockquote",
			content:   "> quoted text",
			maxLength: 100,
			expected:  "quoted text",
		},
		{
			name:      "table cells spaced",
			content:   "| a | b |\n|---|---|\n| 1 | 2 |",
			maxLength: 100,
			expected:  "a b 1 2",
		},
		{
			name:      "plain URL autolink",
			content:   "https://usememos.com",
			maxLength: 100,
			expected:  "https://usememos.com",
		},
		{
			name:      "text with plain URL",
			content:   "Check out https://usememos.com for more info.",
			maxLength: 100,
			expected:  "Check out https://usememos.com for more info.",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			snippet, err := svc.GenerateSnippet([]byte(tt.content), tt.maxLength)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, snippet)
		})
	}

	// Test with tag extension enabled (matches production config).
	svcWithTags := NewService(WithTagExtension())
	tagTests := []struct {
		name      string
		content   string
		maxLength int
		expected  string
	}{
		{
			name:      "tag only",
			content:   "#todo",
			maxLength: 100,
			expected:  "#todo",
		},
		{
			name:      "text with tags",
			content:   "Remember to #review the #code",
			maxLength: 100,
			expected:  "Remember to #review the #code",
		},
	}
	for _, tt := range tagTests {
		t.Run(tt.name, func(t *testing.T) {
			snippet, err := svcWithTags.GenerateSnippet([]byte(tt.content), tt.maxLength)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, snippet)
		})
	}
}

func TestExtractProperties(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		hasLink  bool
		hasCode  bool
		hasTasks bool
		hasInc   bool
		title    string
	}{
		{
			name:     "plain text",
			content:  "Just plain text",
			hasLink:  false,
			hasCode:  false,
			hasTasks: false,
			hasInc:   false,
			title:    "",
		},
		{
			name:     "with link",
			content:  "Check out [this link](https://example.com)",
			hasLink:  true,
			hasCode:  false,
			hasTasks: false,
			hasInc:   false,
			title:    "",
		},
		{
			name:     "with inline code",
			content:  "Use `console.log()` to debug",
			hasLink:  false,
			hasCode:  true,
			hasTasks: false,
			hasInc:   false,
			title:    "",
		},
		{
			name:     "with code block",
			content:  "```go\nfunc main() {}\n```",
			hasLink:  false,
			hasCode:  true,
			hasTasks: false,
			hasInc:   false,
			title:    "",
		},
		{
			name:     "with completed task",
			content:  "- [x] Completed task",
			hasLink:  false,
			hasCode:  false,
			hasTasks: true,
			hasInc:   false,
			title:    "",
		},
		{
			name:     "with incomplete task",
			content:  "- [ ] Todo item",
			hasLink:  false,
			hasCode:  false,
			hasTasks: true,
			hasInc:   true,
			title:    "",
		},
		{
			name:     "mixed tasks",
			content:  "- [x] Done\n- [ ] Not done",
			hasLink:  false,
			hasCode:  false,
			hasTasks: true,
			hasInc:   true,
			title:    "",
		},
		{
			name:     "everything",
			content:  "# Title\n\n[Link](url)\n\n`code`\n\n- [ ] Task",
			hasLink:  true,
			hasCode:  true,
			hasTasks: true,
			hasInc:   true,
			title:    "Title",
		},
		{
			name:    "h1 as first node extracts title",
			content: "# My Article Title\n\nBody text here.",
			title:   "My Article Title",
		},
		{
			name:    "h2 as first node does not extract title",
			content: "## Sub Heading\n\nBody text.",
			title:   "",
		},
		{
			name:    "h1 not first node does not extract title",
			content: "Some text\n\n# Heading Later",
			title:   "",
		},
		{
			name:    "h1 with inline formatting extracts plain text",
			content: "# Title with **bold** and *italic*\n\nBody.",
			title:   "Title with bold and italic",
		},
		{
			name:    "empty content has no title",
			content: "",
			title:   "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := NewService()

			props, err := svc.ExtractProperties([]byte(tt.content))
			require.NoError(t, err)
			assert.Equal(t, tt.hasLink, props.HasLink, "HasLink")
			assert.Equal(t, tt.hasCode, props.HasCode, "HasCode")
			assert.Equal(t, tt.hasTasks, props.HasTaskList, "HasTaskList")
			assert.Equal(t, tt.hasInc, props.HasIncompleteTasks, "HasIncompleteTasks")
			assert.Equal(t, tt.title, props.Title, "Title")
		})
	}
}

func TestExtractAllTitle(t *testing.T) {
	svc := NewService(WithTagExtension())

	tests := []struct {
		name    string
		content string
		title   string
	}{
		{
			name:    "h1 first node",
			content: "# Article Title\n\nContent with #tag",
			title:   "Article Title",
		},
		{
			name:    "no h1",
			content: "Just text with #tag",
			title:   "",
		},
		{
			name:    "h1 not first",
			content: "Intro\n\n# Late Heading",
			title:   "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := svc.ExtractAll([]byte(tt.content))
			require.NoError(t, err)
			assert.Equal(t, tt.title, data.Property.Title, "Title")
		})
	}
}

func TestExtractAllMentions(t *testing.T) {
	svc := NewService(WithTagExtension(), WithMentionExtension())

	data, err := svc.ExtractAll([]byte("Hi @Alice and @bob. Email support@example.com should stay plain. #tag"))
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"Alice", "bob"}, data.Mentions)
	assert.ElementsMatch(t, []string{"tag"}, data.Tags)

	maxLengthUsername := "a" + strings.Repeat("b", base.MaxUsernameLength-1)
	data, err = svc.ExtractAll([]byte("@" + maxLengthUsername))
	require.NoError(t, err)
	assert.Equal(t, []string{maxLengthUsername}, data.Mentions)

	data, err = svc.ExtractAll([]byte("@" + maxLengthUsername + "c"))
	require.NoError(t, err)
	assert.Empty(t, data.Mentions)
}

func TestExtractAllManagedAttachmentImages(t *testing.T) {
	svc := NewService()
	data, err := svc.ExtractAll([]byte(strings.Join([]string{
		"![canonical](/file/attachments/image-one)",
		"![legacy](/file/attachments/image-two/photo.png)",
		"![duplicate](/file/attachments/image-one)",
		"![reference][managed-image]",
		"",
		"[managed-image]: /file/attachments/image-three",
		"![external](https://example.com/file/attachments/external)",
		"`![code](/file/attachments/code-image)`",
	}, "\n")))
	require.NoError(t, err)
	require.Equal(t, []ManagedAttachmentReference{{UID: "image-one"}, {UID: "image-two"}, {UID: "image-three"}}, data.ManagedAttachmentReferences)
	require.Empty(t, data.InvalidManagedAttachmentReferences)
}

func TestExtractAllRejectsMalformedManagedAttachmentImages(t *testing.T) {
	svc := NewService()
	data, err := svc.ExtractAll([]byte(strings.Join([]string{
		"![query](/file/attachments/image-one?share_token=secret)",
		"![encoded](/file/attachments/%69mage-two)",
		"![extra](/file/attachments/image-three/file/extra)",
		`<img src="/file/attachments/raw-html">`,
	}, "\n")))
	require.NoError(t, err)
	require.Empty(t, data.ManagedAttachmentReferences)
	require.Len(t, data.InvalidManagedAttachmentReferences, 4)
}

func TestExtractAllRejectsManagedAttachmentReferencesInRawHTML(t *testing.T) {
	svc := NewService()
	tests := []struct {
		name    string
		content string
	}{
		{
			name:    "inline HTML",
			content: `before <img src="/file/attachments/inline-image"> after`,
		},
		{
			name: "HTML block",
			content: strings.Join([]string{
				"<div>",
				`  <img src="/file/attachments/block-image">`,
				"</div>",
			}, "\n"),
		},
		{
			name: "self-closing HTML block",
			content: strings.Join([]string{
				`<img`,
				`  src="/file/attachments/multiline-image"`,
				`/>`,
			}, "\n"),
		},
		{
			name: "HTML block closure line",
			content: strings.Join([]string{
				"<pre>",
				"content",
				`</pre><img src="/file/attachments/closure-image">`,
			}, "\n"),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			data, err := svc.ExtractAll([]byte(test.content))
			require.NoError(t, err)
			require.Empty(t, data.ManagedAttachmentReferences)
			require.Len(t, data.InvalidManagedAttachmentReferences, 1)
		})
	}
}

func TestExtractAllIgnoresManagedAttachmentReferencesInCode(t *testing.T) {
	svc := NewService()
	data, err := svc.ExtractAll([]byte(strings.Join([]string{
		"`<img src=\"/file/attachments/inline-code\">`",
		"",
		"```html",
		`<img src="/file/attachments/fenced-code">`,
		"```",
	}, "\n")))
	require.NoError(t, err)
	require.Empty(t, data.ManagedAttachmentReferences)
	require.Empty(t, data.InvalidManagedAttachmentReferences)
}

func TestExtractAllMentionSyntaxAndContexts(t *testing.T) {
	svc := NewService(WithTagExtension(), WithMentionExtension())
	tests := []struct {
		name     string
		content  string
		expected []string
	}{
		{name: "writable usernames", content: "@alice @Alice-2 @1alice @a--b @123 @123-456", expected: []string{"alice", "Alice-2", "1alice", "a--b", "123", "123-456"}},
		{name: "invalid username shapes", content: "@-alice @alice- @álîçé"},
		{name: "left boundaries", content: "hello@alice foo-@bob foo_@carol 中文@dave (@erin)", expected: []string{"carol", "dave", "erin"}},
		{name: "non-username right boundaries", content: "@alice_smith @bob@carol", expected: []string{"alice", "bob"}},
		{name: "formatted text", content: "**@Alice** ~~@bob~~ _@carol_", expected: []string{"Alice", "bob", "carol"}},
		{name: "opaque Markdown", content: "`@code` [@link](/x) ![@image](/x) https://example.com/@url $@math$ @ok", expected: []string{"ok"}},
		{name: "escapes and references", content: `\@escaped &#64;entity @ok`, expected: []string{"ok"}},
		{name: "GFM email precedence", content: "@alice@example.com foo@bar.com@bob @ok", expected: []string{"ok"}},
		{name: "padded blockquote", content: ">\t@alice", expected: []string{"alice"}},
		{name: "padded list continuation", content: "- item\n \t@bob", expected: []string{"bob"}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			data, err := svc.ExtractAll([]byte(test.content))
			require.NoError(t, err)
			assert.Equal(t, test.expected, data.Mentions)
		})
	}
}

func TestMentionSourceSpelling(t *testing.T) {
	svc := NewService(WithTagExtension(), WithMentionExtension())
	content := "Hello @Alice-2"

	rendered, err := svc.RenderMarkdown([]byte(content))
	require.NoError(t, err)
	assert.Equal(t, content, rendered)
}

func TestExtractAllSkipsTagsInsideLinks(t *testing.T) {
	svc := NewService(WithTagExtension())

	data, err := svc.ExtractAll([]byte(
		"[release #notes](https://example.com/releases#release-notes)\n\n" +
			"![preview #image](https://example.com/image#preview)\n\n" +
			"Outside #memo-tag",
	))
	require.NoError(t, err)

	assert.ElementsMatch(t, []string{"memo-tag"}, data.Tags)
	assert.True(t, data.Property.HasLink)
}

func TestExtractTags(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		withExt  bool
		expected []string
	}{
		{
			name:     "no tags",
			content:  "Just plain text",
			withExt:  false,
			expected: []string{},
		},
		{
			name:     "single tag",
			content:  "Text with #tag",
			withExt:  true,
			expected: []string{"tag"},
		},
		{
			name:     "multiple tags",
			content:  "Text with #tag1 and #tag2",
			withExt:  true,
			expected: []string{"tag1", "tag2"},
		},
		{
			name:     "duplicate tags",
			content:  "#work is important. #Work #WORK",
			withExt:  true,
			expected: []string{"work", "Work", "WORK"},
		},
		{
			name:     "tags with hyphens and underscores",
			content:  "Tags: #work-notes #2024_plans",
			withExt:  true,
			expected: []string{"work-notes", "2024_plans"},
		},
		{
			name:     "tags at end of sentence",
			content:  "This is important #urgent.",
			withExt:  true,
			expected: []string{"urgent"},
		},
		{
			name:     "headings not tags",
			content:  "## Heading\n\n# Title\n\nText with #realtag",
			withExt:  true,
			expected: []string{"realtag"},
		},
		{
			name:     "numeric tag",
			content:  "Issue #123",
			withExt:  true,
			expected: []string{"123"},
		},
		{
			name:     "tag in list",
			content:  "- Item 1 #todo\n- Item 2 #done",
			withExt:  true,
			expected: []string{"todo", "done"},
		},
		{
			name:     "autolink URL fragment not tag",
			content:  "https://github.com/dmtrKovalenko/fff#pi-agent-extension\n\nProject #memo-tag",
			withExt:  true,
			expected: []string{"memo-tag"},
		},
		{
			name:     "markdown link text and fragment not tags",
			content:  "[release #notes](https://example.com/releases#release-notes) Outside #memo-tag",
			withExt:  true,
			expected: []string{"memo-tag"},
		},
		{
			name:     "reference link text and fragment not tags",
			content:  "[reference #anchor][docs]\n\n[docs]: https://example.com/docs#reference-anchor\n\nOutside #memo-tag",
			withExt:  true,
			expected: []string{"memo-tag"},
		},
		{
			name:     "image alt text and fragment not tags",
			content:  "![preview #image](https://example.com/image#preview)\n\nOutside #memo-tag",
			withExt:  true,
			expected: []string{"memo-tag"},
		},
		{
			name:     "no extension enabled",
			content:  "Text with #tag",
			withExt:  false,
			expected: []string{},
		},
		{
			name:     "Chinese tag",
			content:  "Text with #测试",
			withExt:  true,
			expected: []string{"测试"},
		},
		{
			name:     "Chinese tag followed by punctuation",
			content:  "Text #测试。 More text",
			withExt:  true,
			expected: []string{"测试"},
		},
		{
			name:     "mixed Chinese and ASCII tag",
			content:  "#测试test123 content",
			withExt:  true,
			expected: []string{"测试test123"},
		},
		{
			name:     "Japanese tag",
			content:  "#日本語 content",
			withExt:  true,
			expected: []string{"日本語"},
		},
		{
			name:     "Korean tag",
			content:  "#한국어 content",
			withExt:  true,
			expected: []string{"한국어"},
		},
		{
			name:     "hierarchical tag with Chinese",
			content:  "#work/测试/项目",
			withExt:  true,
			expected: []string{"work", "work/测试", "work/测试/项目"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var svc Service
			if tt.withExt {
				svc = NewService(WithTagExtension())
			} else {
				svc = NewService()
			}

			tags, err := svc.ExtractTags([]byte(tt.content))
			require.NoError(t, err)
			assert.ElementsMatch(t, tt.expected, tags)
		})
	}
}

func TestExtractTagsMemosTagV1(t *testing.T) {
	svc := NewService(WithTagExtension())
	tests := []struct {
		name     string
		content  string
		expected []string
	}{
		{name: "adjacent introducers", content: "#first#second", expected: []string{"first", "second"}},
		{name: "failed introducer does not hide next", content: "##tag", expected: []string{"tag"}},
		{name: "ATX heading marker", content: "## tag", expected: []string{}},
		{name: "number sign keycap", content: "#️⃣", expected: []string{}},
		{name: "number sign keycap value", content: "##️⃣", expected: []string{"#️⃣"}},
		{name: "number sign keycap continuation", content: "#first#️⃣", expected: []string{"first#️⃣"}},
		{name: "exact identity", content: "#Work #work", expected: []string{"Work", "work"}},
		{name: "no normalization", content: "#café #cafe\u0301", expected: []string{"café", "cafe\u0301"}},
		{
			name:     "word internal apostrophes",
			content:  "#tag's #сім'я #O'Brien #O’Brien #OʼBrien #cafe\u0301's",
			expected: []string{"tag's", "сім'я", "O'Brien", "O’Brien", "OʼBrien", "cafe\u0301's"},
		},
		{
			name:     "apostrophe boundaries",
			content:  "'#tag' #users' #'missing #rock''roll #O‘Brien #A\u200d'B",
			expected: []string{"tag", "users", "rock", "O", "A"},
		},
		{name: "ignored spellings deduplicate", content: "#AB #A\u200dB #\u0301AB", expected: []string{"AB"}},
		{name: "hierarchy expansion", content: "#book/fiction/history", expected: []string{"book", "book/fiction", "book/fiction/history"}},
		{name: "hierarchy exact dedupe", content: "#book/fiction #book", expected: []string{"book", "book/fiction"}},
		{name: "literal ampersand", content: "#R&D", expected: []string{"R&D"}},
		{name: "named character reference boundary", content: "#R&amp;D", expected: []string{"R"}},
		{name: "character reference requires a real opener", content: "~#a!&&amp;)*", expected: []string{"a"}},
		{name: "unknown character reference stays literal", content: "#R&bogus;D #Q&amp;&bogus;D", expected: []string{"R&bogus", "Q"}},
		{name: "numeric character reference introducer", content: "&#35;tag &#x23;other", expected: []string{}},
		{name: "named character reference introducer", content: "&num;tag", expected: []string{}},
		{name: "escaped introducer and body", content: "\\#tag #foo\\+bar", expected: []string{"foo"}},
		{name: "code contexts", content: "`#inline`\n\n```text\n#fenced\n```\n\n    #indented", expected: []string{}},
		{name: "blockquote tab paragraph", content: ">\t #tag", expected: []string{"tag"}},
		{name: "trailing spaces before tag line", content: "before  \n#tag", expected: []string{"tag"}},
		{name: "link and image contexts", content: "[#label](https://example.com/#destination) ![#alt](image#fragment)", expected: []string{}},
		{name: "invalid link definition stays text", content: "[#use][bad]\n\n[bad]:(", expected: []string{"use"}},
		{name: "invalid link definition label stays text", content: "[#label]:(", expected: []string{"label"}},
		{name: "email in invalid link definition stays opaque", content: "[#foo@example.com]:(", expected: []string{}},
		{name: "code in invalid link definition stays opaque", content: "[`#code`]:(", expected: []string{}},
		{name: "URL in invalid link definition stays opaque", content: "[ https://example.com/#url]:(", expected: []string{}},
		{name: "balanced bare reference remains a link", content: "[#hidden][valid]\n\n[valid]: path(foo)", expected: []string{}},
		{name: "escaped bare destination parenthesis remains a link", content: "[#hidden][valid]\n\n[valid]: path\\(", expected: []string{}},
		{name: "angle destination parenthesis remains a link", content: "[#hidden][valid]\n\n[valid]: <(>", expected: []string{}},
		{
			name:     "angle autolinks stay opaque",
			content:  "<https://localhost/#local> <ftp://example.com/#ftp> <custom:foo#custom> <https://foo.example_/#underscore>",
			expected: []string{},
		},
		{name: "literal URL context", content: "https://example.com/path#url /path#plain", expected: []string{"plain"}},
		{
			name:     "non GFM URL schemes and forms stay text",
			content:  "ftp://example.com/#ftp HTTP://example.com/#upper https://localhost/#local",
			expected: []string{"ftp", "upper", "local"},
		},
		{
			name:     "written GFM URL domains and paths",
			content:  "https://example.COM/#hidden www.example.123/#also-hidden https://a_b.foo.example/路径#still-hidden https://foo_bar.example/#visible",
			expected: []string{"visible"},
		},
		{
			name: "written GFM URL Unicode domains",
			content: "https://點看.com/#hidden www.點看.com/#also-hidden https://a_b.點看.com/#still-hidden " +
				"https://foo_bar.點看/#visible https://點看.com_/#suffix hellohttps://點看.com/#joined",
			expected: []string{"visible", "suffix", "joined"},
		},
		{
			name: "written GFM URL protocol and www boundaries",
			content: "1https://點看.com/#digit .https://點看.com/#punctuation ]www.點看.com/#www " +
				"中https://點看.com/#unicode hellohttps://點看.com/#joined " +
				"[https://點看.com/#unbalanced\n\n[www.點看.com/#unbalanced-www\n\n" +
				`\[https://點看.com/#escaped` + "\n\n" + `\[www.點看.com/#escaped-www`,
			expected: []string{
				"digit", "punctuation", "www", "unicode", "joined", "unbalanced", "unbalanced-www", "escaped", "escaped-www",
			},
		},
		{
			name: "written GFM URL domain validation",
			content: "http://example.com#hidden http://example.com./#also-hidden https://foo.example_/#visible\n" +
				"-\thttps://foo.example_/#padded\n\n(https://foo.example_/#parenthesized) *https://foo.example_/#emphasized*",
			expected: []string{"visible", "padded", "parenthesized", "emphasized"},
		},
		{name: "initial BOM before written GFM URL", content: "\ufeffhttps://example.com/#hidden #shown", expected: []string{"shown"}},
		{name: "second initial BOM is ordinary text", content: "\ufeff\ufeffhttps://example.com/#shown", expected: []string{"shown"}},
		{name: "mid-document BOM does not start written GFM URL", content: "before\n\n\ufeffhttps://example.com/#shown", expected: []string{"shown"}},
		{name: "written URL inside unresolved bracket text", content: "[text https://點看.com/#inside [more https://example.com/#ascii", expected: []string{}},
		{
			name:     "written URL inside closed unresolved bracket text",
			content:  "[ https://example.com/#hidden] [x https://example.com/#also-hidden] ![ https://example.com/#image-hidden]",
			expected: []string{},
		},
		{
			name: "separator characters end written URL",
			content: "https://點看.com/\u00a0#nbsp https://點看.com/\u2003#em-space https://點看.com/\u000b#vertical-tab " +
				"https://點看.com/\u2028#line-separator https://點看.com/\u2029#paragraph-separator https://點看.com/\u0085#nel-hidden",
			expected: []string{"nbsp", "em-space", "vertical-tab", "line-separator", "paragraph-separator"},
		},
		{
			name:     "written GFM email boundaries",
			content:  "foo#mail@example.com foo!#second@example.com <foo#hidden@example.com> foo@example.com/#after",
			expected: []string{"after"},
		},
		{name: "invalid GFM email local part", content: "#foo!bar@example.com", expected: []string{"foo"}},
		{name: "email after tag hierarchy separator", content: "#foo/bar@example.com", expected: []string{"foo"}},
		{name: "GFM email after Unicode tag", content: "#中mail@example.com", expected: []string{"中"}},
		{name: "email after padded list tag", content: "-\t#foo/bar@example.com", expected: []string{"foo"}},
		{name: "invalid GFM email domain suffix", content: "#foo/bar@example.com_", expected: []string{"foo", "foo/bar"}},
		{name: "escaped punctuation is decoded in GFM email autolinks", content: `#foo\+bar@example.com #next\_item@example.com`, expected: []string{}},
		{name: "numeric entity joins GFM email", content: `#foo&#46;bar@example.com #foo&#64;example.com`, expected: []string{}},
		{name: "named entity joins GFM email", content: `#foo&period;bar@example.com`, expected: []string{}},
		{name: "unknown entity does not join GFM email", content: `#foo&bogus;bar@example.com`, expected: []string{"foo&bogus"}},
		{name: "email inside emphasis", content: "_foo@example.com #tag_", expected: []string{"tag"}},
		{name: "raw HTML syntax", content: "<span data-tag=\"#attribute\">#text</span>", expected: []string{"text"}},
		{name: "inline math", content: "$#math$ #plain", expected: []string{"plain"}},
		{name: "currency dollars leave tags visible", content: "$20,000 #budget and $30,000", expected: []string{"budget"}},
		{name: "inline math exact closing run", content: "$#one$$ #two$ #plain", expected: []string{"plain"}},
		{name: "inline math does not reopen within a dollar run", content: "$$#math$ #plain", expected: []string{"math", "plain"}},
		{name: "inline math after escaped dollar", content: "\\$$#math$ #plain", expected: []string{"plain"}},
		{name: "display math", content: "$$\n#math\n$$\n\n#plain", expected: []string{"plain"}},
		{name: "unclosed math flow", content: "$$meta\n#math", expected: []string{}},
		{name: "unclosed math flow across blocks", content: "$$meta\n\n#math", expected: []string{}},
		{name: "unclosed math flow in quote", content: "> $$meta\n> #math", expected: []string{}},
		{name: "flow math stays inside quote", content: "> $$\n> #math\noutside #plain", expected: []string{"plain"}},
		{name: "flow math spans quote blocks", content: "> $$\n> #math\n>\n> #still-math\n> $$\noutside #plain", expected: []string{"plain"}},
		{name: "flow math stays inside list item", content: "- $$\n  #math\n#outside", expected: []string{"outside"}},
		{name: "flow math spans list item blank lines", content: "- $$\n  \n  #math\n  $$\n\n#outside", expected: []string{"outside"}},
		{name: "dollar in flow metadata stays text", content: "$$meta$x\n#plain", expected: []string{"plain"}},
		{name: "math fence inside code is inert", content: "```text\n$$\n```\n\n#plain", expected: []string{"plain"}},
		{name: "unmatched inline dollar", content: "text $ #plain", expected: []string{"plain"}},
		{name: "formatted text", content: "**#strong** ~~#strike~~", expected: []string{"strong", "strike"}},
		{name: "emphasis is a hard boundary", content: "#_foo_", expected: []string{}},
		{name: "unmatched underscore", content: "#_", expected: []string{"_"}},
		{name: "intraword underscore", content: "#foo_bar", expected: []string{"foo_bar"}},
		{name: "no length limit", content: "#" + strings.Repeat("a", 101), expected: []string{strings.Repeat("a", 101)}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tags, err := svc.ExtractTags([]byte(tt.content))
			require.NoError(t, err)
			if len(tt.expected) == 0 {
				assert.Empty(t, tags)
			} else {
				assert.Equal(t, tt.expected, tags)
			}
		})
	}
}

func TestExtractAllExpandsTagHierarchy(t *testing.T) {
	svc := NewService(WithTagExtension())
	data, err := svc.ExtractAll([]byte("#book/fiction/history #book"))
	require.NoError(t, err)
	assert.Equal(t, []string{"book", "book/fiction", "book/fiction/history"}, data.Tags)
}

func TestExtractAllResolvesGFMEmailBeforeMention(t *testing.T) {
	svc := NewService(WithTagExtension(), WithMentionExtension())
	data, err := svc.ExtractAll([]byte("#foo/bar_baz@example.com #next/item_@example.com @alice"))
	require.NoError(t, err)
	assert.Equal(t, []string{"foo", "next"}, data.Tags)
	assert.Equal(t, []string{"alice"}, data.Mentions)
	assert.True(t, data.Property.HasLink)
}

func TestInvalidLinkDefinitionsRetainInlineContexts(t *testing.T) {
	svc := NewService(WithTagExtension())
	data, err := svc.ExtractAll([]byte("[#foo@example.com]:(\n\n[`#code`]:("))
	require.NoError(t, err)
	assert.Empty(t, data.Tags)
	assert.True(t, data.Property.HasLink)
	assert.True(t, data.Property.HasCode)
}

func TestTagSourceSpelling(t *testing.T) {
	svc := NewService(WithTagExtension())
	content := "#A\u200dB #\u0301foo"

	rendered, err := svc.RenderMarkdown([]byte(content))
	require.NoError(t, err)
	assert.Equal(t, content, rendered)

	snippet, err := svc.GenerateSnippet([]byte(content), 100)
	require.NoError(t, err)
	assert.Equal(t, content, snippet)

	renamed, err := svc.RenameTag([]byte(content), "AB", "done")
	require.NoError(t, err)
	assert.Equal(t, "#done #\u0301foo", renamed)
}

func TestExtractAllRecognizesGFMURLsInsideUnresolvedBracketText(t *testing.T) {
	svc := NewService(WithTagExtension())
	for _, content := range []string{
		"[ https://example.com/#hidden]",
		"[x https://example.com/#hidden]",
		"![ https://example.com/#hidden]",
		"[text https://example.com/#hidden",
	} {
		data, err := svc.ExtractAll([]byte(content))
		require.NoError(t, err)
		assert.Empty(t, data.Tags)
		assert.True(t, data.Property.HasLink)
	}
}

func TestEscapedGFMEmailPreservesSource(t *testing.T) {
	svc := NewService(WithTagExtension(), WithMentionExtension())
	content := `#foo\+bar@example.com #next\_item@example.com #foo\@example\.com`

	rendered, err := svc.RenderMarkdown([]byte(content))
	require.NoError(t, err)
	assert.Equal(t, content, rendered)

	data, err := svc.ExtractAll([]byte(content))
	require.NoError(t, err)
	assert.Empty(t, data.Tags)
	assert.Empty(t, data.Mentions)
	assert.True(t, data.Property.HasLink)
}

func TestMathRenderingPreservesLiteralSource(t *testing.T) {
	svc := NewService(WithTagExtension())
	for _, content := range []string{
		"$x < y$\n\n$$meta\nx < y\n$$",
		"> $$meta\n> x < y\n> $$",
		"- $$meta\n  x < y\n  $$",
		"- $$meta\n  \n  x < y\n  $$",
		"- $$meta\n  x < y\n  $$\n- next",
		"10. $$meta\n    x < y\n    $$",
	} {
		rendered, err := svc.RenderMarkdown([]byte(content))
		require.NoError(t, err)
		assert.Equal(t, content, rendered)
	}
}

func TestRenderMarkdownPreservesLineBreakAfterTag(t *testing.T) {
	svc := NewService(WithTagExtension())
	for _, content := range []string{"#tag\nnext", "#tag  \nnext"} {
		rendered, err := svc.RenderMarkdown([]byte(content))
		require.NoError(t, err)
		assert.Equal(t, content, rendered)
	}
}

func TestRenameTagSkipsTagsInsideLinks(t *testing.T) {
	svc := NewService(WithTagExtension())

	result, err := svc.RenameTag(
		[]byte("[release #notes](https://example.com/releases#release-notes)\n\nOutside #notes"),
		"notes",
		"done",
	)
	require.NoError(t, err)

	assert.Equal(t, "[release #notes](https://example.com/releases#release-notes)\n\nOutside #done", result)
}

func TestRenameTagOnlyChangesRecognizedSourceSpans(t *testing.T) {
	svc := NewService(WithTagExtension())
	for _, content := range []string{
		"<span>#old</span>",
		"<https://example.com/#x> user@example.com #old",
		"#old\n$$\nx\n$$\nnext",
	} {
		result, err := svc.RenameTag([]byte(content), "old", "new")
		require.NoError(t, err)
		assert.Equal(t, strings.ReplaceAll(content, "#old", "#new"), result)
	}
}

func TestRenameTagReplacesEveryExactSourceSpan(t *testing.T) {
	svc := NewService(WithTagExtension())
	content := "#old #o\u200dld #old#old [#old](url) https://example.com/#old #Old"

	result, err := svc.RenameTag([]byte(content), "old", "new")
	require.NoError(t, err)
	assert.Equal(t, "#new #new #new#new [#old](url) https://example.com/#old #Old", result)
}

func TestUniquePreserveCase(t *testing.T) {
	tests := []struct {
		name     string
		input    []string
		expected []string
	}{
		{
			name:     "empty",
			input:    []string{},
			expected: []string{},
		},
		{
			name:     "unique items",
			input:    []string{"tag1", "tag2", "tag3"},
			expected: []string{"tag1", "tag2", "tag3"},
		},
		{
			name:     "duplicates",
			input:    []string{"tag", "TAG", "Tag"},
			expected: []string{"tag", "TAG", "Tag"},
		},
		{
			name:     "mixed",
			input:    []string{"Work", "work", "Important", "work"},
			expected: []string{"Work", "work", "Important"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := uniquePreserveCase(tt.input)
			assert.ElementsMatch(t, tt.expected, result)
		})
	}
}

func TestTruncateAtWord(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		maxLength int
		expected  string
	}{
		{
			name:      "no truncation needed",
			input:     "short",
			maxLength: 10,
			expected:  "short",
		},
		{
			name:      "exact length",
			input:     "exactly ten",
			maxLength: 11,
			expected:  "exactly ten",
		},
		{
			name:      "truncate at word",
			input:     "this is a long sentence",
			maxLength: 10,
			expected:  "this is a ...",
		},
		{
			name:      "truncate very long word",
			input:     "supercalifragilisticexpialidocious",
			maxLength: 10,
			expected:  "supercalif ...",
		},
		{
			name:      "CJK characters without spaces",
			input:     "这是一个很长的中文句子没有空格的情况下也要正确处理",
			maxLength: 15,
			expected:  "这是一个很长的中文句子没有空格 ...",
		},
		{
			name:      "mixed CJK and Latin",
			input:     "这是中文mixed with English文字",
			maxLength: 10,
			expected:  "这是中文mixed ...",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := truncateAtWord(tt.input, tt.maxLength)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// Benchmark tests.
func BenchmarkGenerateSnippet(b *testing.B) {
	svc := NewService()
	content := []byte(`# Large Document

This is a large document with multiple paragraphs and formatting.

## Section 1

Here is some **bold** text and *italic* text with [links](https://example.com).

- List item 1
- List item 2
- List item 3

## Section 2

More content here with ` + "`inline code`" + ` and other elements.

` + "```go\nfunc example() {\n    return true\n}\n```")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := svc.GenerateSnippet(content, 200)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkExtractProperties(b *testing.B) {
	svc := NewService()
	content := []byte("# Title\n\n[Link](url)\n\n`code`\n\n- [ ] Task\n- [x] Done")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := svc.ExtractProperties(content)
		if err != nil {
			b.Fatal(err)
		}
	}
}
