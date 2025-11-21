package markdown

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			snippet, err := svc.GenerateSnippet([]byte(tt.content), tt.maxLength)
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
	}{
		{
			name:     "plain text",
			content:  "Just plain text",
			hasLink:  false,
			hasCode:  false,
			hasTasks: false,
			hasInc:   false,
		},
		{
			name:     "with link",
			content:  "Check out [this link](https://example.com)",
			hasLink:  true,
			hasCode:  false,
			hasTasks: false,
			hasInc:   false,
		},
		{
			name:     "with inline code",
			content:  "Use `console.log()` to debug",
			hasLink:  false,
			hasCode:  true,
			hasTasks: false,
			hasInc:   false,
		},
		{
			name:     "with code block",
			content:  "```go\nfunc main() {}\n```",
			hasLink:  false,
			hasCode:  true,
			hasTasks: false,
			hasInc:   false,
		},
		{
			name:     "with completed task",
			content:  "- [x] Completed task",
			hasLink:  false,
			hasCode:  false,
			hasTasks: true,
			hasInc:   false,
		},
		{
			name:     "with incomplete task",
			content:  "- [ ] Todo item",
			hasLink:  false,
			hasCode:  false,
			hasTasks: true,
			hasInc:   true,
		},
		{
			name:     "mixed tasks",
			content:  "- [x] Done\n- [ ] Not done",
			hasLink:  false,
			hasCode:  false,
			hasTasks: true,
			hasInc:   true,
		},
		{
			name:     "everything",
			content:  "# Title\n\n[Link](url)\n\n`code`\n\n- [ ] Task",
			hasLink:  true,
			hasCode:  true,
			hasTasks: true,
			hasInc:   true,
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
		})
	}
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
			expected: []string{"work"}, // Deduplicated and lowercased
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
			expected: []string{"work/测试/项目"},
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

func TestUniqueLowercase(t *testing.T) {
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
			expected: []string{"tag"},
		},
		{
			name:     "mixed",
			input:    []string{"Work", "work", "Important", "work"},
			expected: []string{"work", "important"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := uniqueLowercase(tt.input)
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
			name:      "Chinese characters - no truncation",
			input:     "这是一段中文测试文本",
			maxLength: 50,
			expected:  "这是一段中文测试文本",
		},
		{
			name:      "Chinese characters - truncate at word boundary",
			input:     "这是一段比较长的中文测试文本，用来验证截断功能是否正常工作",
			maxLength: 20,
			expected:  "这是一段比较长的中文测试文本，用来验证截 ...",
		},
		{
			name:      "Chinese characters - truncate mid-sentence",
			input:     "这是一段比较长的中文测试文本，用来验证截断功能是否正常工作",
			maxLength: 15,
			expected:  "这是一段比较长的中文测试文本， ...",
		},
		{
			name:      "Mixed English and Chinese",
			input:     "This is a test 这是一个测试 with mixed content",
			maxLength: 20,
			expected:  "This is a test ...",
		},
		{
			name:      "Japanese characters",
			input:     "日本語のテキストを切り詰めるテスト",
			maxLength: 10,
			expected:  "日本語のテキストを切 ...",
		},
		{
			name:      "Korean characters",
			input:     "한국어 텍스트 잘라내기 테스트입니다",
			maxLength: 10,
			expected:  "한국어 텍스트 ...",
		},
		{
			name:      "Emoji characters",
			input:     "Hello 👋 World 🌍 with emoji 😊",
			maxLength: 15,
			expected:  "Hello 👋 World ...",
		},
		{
			name:      "UTF-8 boundary test - exactly at character",
			input:     "测试",
			maxLength: 2,
			expected:  "测试",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := truncateAtWord(tt.input, tt.maxLength)
			assert.Equal(t, tt.expected, result)
			// Verify result is always valid UTF-8
			assert.True(t, isValidUTF8(result), "Result should be valid UTF-8: %q", result)
		})
	}
}

// isValidUTF8 checks if a string contains valid UTF-8 encoding.
func isValidUTF8(s string) bool {
	// Try to convert to runes and back - invalid UTF-8 will cause issues
	runes := []rune(s)
	return string(runes) == s
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
