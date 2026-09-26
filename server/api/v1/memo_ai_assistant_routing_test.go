package v1

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func assistant(id, title string, enabled bool, tags ...string) *storepb.AIAssistantConfig {
	return &storepb.AIAssistantConfig{
		Id:      id,
		Title:   title,
		Enabled: enabled,
		Tags:    tags,
	}
}

func TestRouteAssistantForTags(t *testing.T) {
	fallback := assistant("default", "Default", true)
	books := assistant("books", "Books", true, "book")
	work := assistant("work", "Work", true, "work", "project")

	config := &storepb.AssistantsConfig{
		Enabled:    true,
		Assistants: []*storepb.AIAssistantConfig{books, work, fallback},
	}

	tests := []struct {
		name         string
		memoTags     []string
		wantID       string
		wantMatched  string
		wantNoAssign bool
	}{
		{name: "exact tag match", memoTags: []string{"book"}, wantID: "books", wantMatched: "book"},
		{name: "nested child matches parent", memoTags: []string{"book/novel"}, wantID: "books", wantMatched: "book/novel"},
		{name: "case insensitive", memoTags: []string{"Book"}, wantID: "books", wantMatched: "Book"},
		{name: "second tag of an assistant", memoTags: []string{"project"}, wantID: "work", wantMatched: "project"},
		{name: "unmatched falls back", memoTags: []string{"random"}, wantID: "default"},
		{name: "no tags falls back", memoTags: nil, wantID: "default"},
		// "books" is configured before "work", so order decides ties.
		{name: "first configured match wins", memoTags: []string{"work", "book"}, wantID: "books", wantMatched: "book"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			route := routeAssistantForTags(config, test.memoTags)
			require.NotNil(t, route)
			assert.Equal(t, test.wantID, route.assistant.GetId())
			assert.Equal(t, test.wantMatched, route.matchedTag)
		})
	}
}

func TestRouteAssistantForTagsSkipsDisabled(t *testing.T) {
	config := &storepb.AssistantsConfig{
		Enabled: true,
		Assistants: []*storepb.AIAssistantConfig{
			assistant("books", "Books", false, "book"),
			assistant("default", "Default", true),
		},
	}

	// A disabled tag assistant must not swallow its tag; routing continues to
	// the fallback instead of silently dropping the review.
	route := routeAssistantForTags(config, []string{"book"})
	require.NotNil(t, route)
	assert.Equal(t, "default", route.assistant.GetId())
}

func TestRouteAssistantForTagsReturnsNil(t *testing.T) {
	tagged := []*storepb.AIAssistantConfig{assistant("books", "Books", true, "book")}

	tests := []struct {
		name   string
		config *storepb.AssistantsConfig
		tags   []string
	}{
		{name: "nil config", config: nil, tags: []string{"book"}},
		{name: "feature disabled", config: &storepb.AssistantsConfig{Enabled: false, Assistants: tagged}, tags: []string{"book"}},
		{name: "no assistant matches and no fallback", config: &storepb.AssistantsConfig{Enabled: true, Assistants: tagged}, tags: []string{"other"}},
		{name: "every assistant disabled", config: &storepb.AssistantsConfig{
			Enabled:    true,
			Assistants: []*storepb.AIAssistantConfig{assistant("books", "Books", false, "book")},
		}, tags: []string{"book"}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Nil(t, routeAssistantForTags(test.config, test.tags))
		})
	}
}

func TestTagMatches(t *testing.T) {
	assert.True(t, tagMatches("book", "book"))
	assert.True(t, tagMatches("book", "book/novel"))
	assert.True(t, tagMatches("book", "book/novel/scifi"))
	assert.False(t, tagMatches("book", "books"))
	assert.False(t, tagMatches("book", "notebook"))
	assert.False(t, tagMatches("book/novel", "book"))
	assert.False(t, tagMatches("", "book"))
}

func TestNormalizeAssistantTags(t *testing.T) {
	tags, err := normalizeAssistantTags([]string{" #book ", "book", "#work/", "", "   "})
	require.NoError(t, err)
	// Leading "#", surrounding whitespace, trailing "/" and duplicates are all
	// normalized away so stored tags compare cleanly against memo payload tags.
	assert.Equal(t, []string{"book", "work"}, tags)
}

func TestNormalizeAssistantTagsRejectsOversized(t *testing.T) {
	_, err := normalizeAssistantTags([]string{strings.Repeat("a", maxAssistantTagLength+1)})
	require.Error(t, err)

	tooMany := make([]string, maxAssistantTags+1)
	for i := range tooMany {
		tooMany[i] = string(rune('a' + i%26))
	}
	_, err = normalizeAssistantTags(tooMany)
	require.Error(t, err)
}

func TestBuildAssistantInput(t *testing.T) {
	memo := &store.Memo{Content: "Today I read about deliberate practice."}

	input := buildAssistantInput(memo, nil)
	assert.Contains(t, input, "Today I read about deliberate practice.")
	assert.NotContains(t, input, "Earlier notes")

	withContext := buildAssistantInput(memo, []*store.Memo{
		{Content: "Earlier thought one."},
		{Content: "Earlier thought two."},
	})
	assert.Contains(t, withContext, "Earlier notes for context")
	assert.Contains(t, withContext, "Earlier thought one.")
	assert.Contains(t, withContext, "Earlier thought two.")
}

func TestTruncateRunesCountsCharactersNotBytes(t *testing.T) {
	// Multi-byte content must be cut by character count, otherwise a Chinese
	// note would be truncated to a third of the intended length.
	assert.Equal(t, "读书笔记", truncateRunes("读书笔记", 4))
	assert.Equal(t, "读书…", truncateRunes("读书笔记", 2))
	assert.Equal(t, "abc", truncateRunes("abc", 10))
}
