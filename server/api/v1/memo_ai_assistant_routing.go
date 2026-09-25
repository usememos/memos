package v1

import (
	"strings"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// assistantRoute is the assistant selected for one memo, plus the tag that
// selected it. matchedTag is empty when the fallback assistant was used.
type assistantRoute struct {
	assistant  *storepb.AIAssistantConfig
	matchedTag string
}

// routeAssistantForTags picks the assistant that should review a memo.
//
// Assistants are evaluated in configured order. The first enabled assistant
// with a matching tag wins; when nothing matches, the first enabled assistant
// without any tags acts as the fallback. Returns nil when no assistant applies.
func routeAssistantForTags(config *storepb.AssistantsConfig, memoTags []string) *assistantRoute {
	if config == nil || !config.GetEnabled() {
		return nil
	}

	var fallback *storepb.AIAssistantConfig
	for _, assistant := range config.GetAssistants() {
		if assistant == nil || !assistant.GetEnabled() {
			continue
		}
		if len(assistant.GetTags()) == 0 {
			if fallback == nil {
				fallback = assistant
			}
			continue
		}
		if matched, ok := matchAssistantTag(assistant.GetTags(), memoTags); ok {
			return &assistantRoute{assistant: assistant, matchedTag: matched}
		}
	}

	if fallback != nil {
		return &assistantRoute{assistant: fallback}
	}
	return nil
}

// matchAssistantTag reports the memo tag that matches one of the assistant's
// routing tags. A routing tag also matches its nested children, so "book"
// matches a memo tagged "book/notes".
func matchAssistantTag(assistantTags, memoTags []string) (string, bool) {
	for _, memoTag := range memoTags {
		memoTag = strings.TrimSpace(memoTag)
		if memoTag == "" {
			continue
		}
		for _, assistantTag := range assistantTags {
			if tagMatches(assistantTag, memoTag) {
				return memoTag, true
			}
		}
	}
	return "", false
}

func tagMatches(assistantTag, memoTag string) bool {
	if assistantTag == "" {
		return false
	}
	// Tags are matched case-insensitively so "#Book" and "#book" route alike.
	if strings.EqualFold(assistantTag, memoTag) {
		return true
	}
	return len(memoTag) > len(assistantTag) &&
		strings.EqualFold(assistantTag, memoTag[:len(assistantTag)]) &&
		memoTag[len(assistantTag)] == '/'
}
