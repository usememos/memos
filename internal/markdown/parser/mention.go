package parser

import (
	"github.com/yuin/goldmark/util"

	"github.com/usememos/memos/internal/base"
)

// MentionMatch is one username reference in an eligible literal-source run.
type MentionMatch struct {
	// Start is the byte offset of the @ introducer within the source run.
	Start int
	// End is the exclusive byte offset of the recognized source spelling.
	End int
	// Username is the exact username without the @ introducer.
	Username []byte
}

func hasMentionLeftBoundary(source []byte, pos int, runHasLeftBoundary bool) bool {
	if pos == 0 {
		return runHasLeftBoundary
	}
	return !base.IsUsernameCharacter(source[pos-1])
}

// FindMentionMatches enumerates username references in one eligible literal-source run.
// Markdown structure and GFM email precedence must be resolved before calling it.
func FindMentionMatches(source []byte, runHasLeftBoundary bool) []MentionMatch {
	var matches []MentionMatch
	for pos := 0; pos < len(source); {
		if source[pos] == '\\' && pos+1 < len(source) && util.IsPunct(source[pos+1]) {
			pos += 2
			continue
		}
		if source[pos] != '@' || !hasMentionLeftBoundary(source, pos, runHasLeftBoundary) {
			pos++
			continue
		}

		end := pos + 1
		for end < len(source) && base.IsUsernameCharacter(source[end]) {
			end++
		}
		username := source[pos+1 : end]
		if base.IsValidUsername(string(username)) {
			matches = append(matches, MentionMatch{
				Start:    pos,
				End:      end,
				Username: append([]byte(nil), username...),
			})
		}
		if end == pos+1 {
			pos++
		} else {
			pos = end
		}
	}
	return matches
}
