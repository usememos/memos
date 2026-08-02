package parser

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/usememos/memos/internal/base"
)

func TestFindMentionMatches(t *testing.T) {
	tests := []struct {
		name               string
		source             string
		runHasLeftBoundary bool
		want               []string
	}{
		{name: "valid", source: "@alice @Alice-2 @123 @123-456", runHasLeftBoundary: true, want: []string{"alice", "Alice-2", "123", "123-456"}},
		{name: "maximum length", source: "@a" + strings.Repeat("b", base.MaxUsernameLength-1), runHasLeftBoundary: true, want: []string{"a" + strings.Repeat("b", base.MaxUsernameLength-1)}},
		{name: "too long", source: "@a" + strings.Repeat("b", base.MaxUsernameLength), runHasLeftBoundary: true},
		{name: "invalid shapes", source: "@-alice @alice- @álîçé", runHasLeftBoundary: true},
		{name: "username character left boundary", source: "hello@alice foo-@bob foo_@carol", runHasLeftBoundary: true, want: []string{"carol"}},
		{name: "Unicode left boundary", source: "中文@alice", runHasLeftBoundary: true, want: []string{"alice"}},
		{name: "run starts after word", source: "@alice", runHasLeftBoundary: false},
		{name: "non-username right boundaries", source: "@alice_smith @bob@carol", runHasLeftBoundary: true, want: []string{"alice", "bob"}},
		{name: "punctuation", source: "(@alice), @bob.", runHasLeftBoundary: true, want: []string{"alice", "bob"}},
		{name: "escaped introducer", source: `\@alice @bob`, runHasLeftBoundary: true, want: []string{"bob"}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			matches := FindMentionMatches([]byte(test.source), test.runHasLeftBoundary)
			var got []string
			for _, match := range matches {
				assert.Equal(t, "@"+string(match.Username), test.source[match.Start:match.End])
				got = append(got, string(match.Username))
			}
			assert.Equal(t, test.want, got)
		})
	}
}
